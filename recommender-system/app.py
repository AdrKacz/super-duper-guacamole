import json
import boto3
import numpy as np
import os
from urllib import parse
from botocore.exceptions import ClientError
from helpers import *

# Get the service resource.
client_dynamodb = boto3.resource("dynamodb")
# Access the desired table resource
table_model_y = client_dynamodb.Table("awa-model-y")
mapping_table = client_dynamodb.Table("awa-mapping-table")
demapping_table = client_dynamodb.Table("awa-demapping-table")
gradient_y_table = client_dynamodb.Table("awa-gradient_y_table")
# Define the client to interact with AWS Lambda
client_lambda = boto3.client("lambda")

# Environment variables
K_VAL = int(os.environ.get("K_VAL"))
# n_users = int(os.environ.get('n_users'))
ARN_LAMBDA_X = os.environ.get("ARN_LAMBDA_X")
N_ITER_ADAM = int(os.environ.get("N_ITER_ADAM"))
GAMMA = float(os.environ.get("GAMMA"))
BETA_1 = float(os.environ.get("BETA_1"))
BETA_2 = float(os.environ.get("BETA_2"))
EPSILON = float(os.environ.get("EPSILON"))
LAMBDA_REG = float(os.environ.get("LAMBDA_REG"))
THRESHOLD_UPDATE = float(os.environ.get("THRESHOLD_UPDATE"))
VERBOSE = bool(os.environ.get("VERBOSE"))
assert K_VAL is not None and ARN_LAMBDA_X is not None

# Field names
field_user_id_raw = "user_id_raw"
field_user_id = "user_id"


def get_user_id(event, query_string, verbose=False):
    if verbose:
        print(event[query_string])  # 'user_id=2'
    url_parsed = parse.parse_qs(event["rawQueryString"])  # {'user_id':['2']}
    return "".join(url_parsed["user_id"])


def create_new_y_user(table, key_name, key, k, item_name, verbose=False):
    response = put_item_vector_table(
        table, key_name, key, item_name, np.random.rand(k), verbose=verbose
    )
    return response


def transform_json_vector_to_matrix(json_vector, data_axis):
    """Transform a vector saved in a list form in a json object
    to a double dimension np.ndarray (a matrix)"""
    vector = np.array(json.loads(json_vector))
    try:
        assert data_axis == 0 or data_axis == 1
    except:
        print("Calling function with wrong axis attribute")
    else:
        if data_axis == 0:
            vector = vector[:, np.newaxis]
        elif data_axis == 1:
            vector = vector[np.newaxis, :]
        return vector


def get_y_model_vector(table, key_name, key, item_name, data_axis):
    """Return the user_id row of the X matrix latent factor
    X is the local-user part of the model.
    """
    x_u_json_vector = get_item(table, key_name, key, item_name)
    try:
        return transform_json_vector_to_matrix(x_u_json_vector, data_axis)
    except:
        print("Error in the x_u type got in the X model table")


def get_mapped(table, key_name, key, field_name):
    try:
        response = table.get_item(Key={key_name: key})
    except ClientError as e:
        print(e.response["Error"]["Message"])
    else:
        return response["Item"][field_name]


def handler(event, context):
    print("Event: ", event)  #  api_gateway_endpoint?user_id=2
    try:
        user_id_raw = get_user_id(event, "rawQueryString", verbose=VERBOSE)
    except:
        return {"statusCode": "400", " body": "Wrong data types"}
    ### Mapped id:
    user_id = str(
        get_mapped(mapping_table, field_user_id_raw, user_id_raw, field_user_id)
    )
    print(user_id)
    response = table_model_y.get_item(Key={"user_id": user_id})
    ### User creation
    if "Item" not in response:
        try:
            response = create_new_y_user(
                table_model_y, "user_id", user_id, K_VAL, "vector", verbose=VERBOSE
            )
            print(response)
            assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
        except:
            return {
                "statusCode": "500",
                "body": "Error adding the user to the model Y database",
            }

    #### Reconstruct the Y matrix of the Master Model
    max_mapped = int(get_mapped(mapping_table, field_user_id_raw, "max", "user_id"))
    y_matrix = np.zeros((max_mapped + 1, K_VAL))  # .T at the end of the for loop
    try:
        response = table_model_y.scan()
        if VERBOSE:
            print(response)
        items = response["Items"]
        if VERBOSE:
            print(items)
        for item in items:
            user_temp_id = int(item["user_id"])
            vector = np.array(json.loads(item["vector"]))
            y_matrix[user_temp_id, :] = vector
        y_matrix = y_matrix.T
        n_users = (
            max_mapped + 1
        )  # In the worst case, if R updated (new user) and Y is not updated yet, a row in Y will be full of zeros
        assert y_matrix.shape == (K_VAL, n_users)
    except:
        return {"statusCode": "400", "body": "Wrong Y matrix shape"}

    ### Interaction with the AWS lambda of the x-part of the model (users)
    # Define the input parameters that will be passed on to the model x function
    input_x = json.dumps(
        {
            "user_id": user_id,
            "y_matrix": y_matrix.tolist(),
            "K_VAL": K_VAL,
            "n_users": n_users,
        },
        separators=(",", ":"),
        sort_keys=True,
        indent=4,
    )

    response = client_lambda.invoke(
        FunctionName=ARN_LAMBDA_X, InvocationType="RequestResponse", Payload=input_x
    )
    print("Response : ", response)
    try:
        assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
    except:
        return {"statusCode": "400", "body": "Error returned by the Lambda X"}
    else:
        x_response = response["Payload"].read()
        x_json_1 = json.loads(x_response)
        print("PayLoad :", x_response)

    try:
        x_json_2 = json.loads(x_json_1)
        print("PayLoad JSON:", x_json_2)
    except:
        return {"statusCode": x_json_1["statusCode"], "body": x_json_1["body"]}

    try:
        inference_x = np.array(x_json_2["inference_x"])
        f_u = np.array(x_json_2["f_u"])
        print(inference_x.shape, f_u.shape)
        assert inference_x.shape == (1, n_users) and f_u.shape == (n_users, K_VAL)
    except:
        return {"statusCode": "400", "body": "Wrong inference format"}

    ### Aggregation of the client's gradient
    # Add gradient to the gradient table:
    response = gradient_y_table.get_item(Key={"user_id": user_id})
    print("Response Y gradient :", response)
    if "Item" not in response:
        try:
            response = put_item_vector_table(
                gradient_y_table,
                "user_id",
                user_id,
                "gradient_from_user",
                f_u,
                verbose=VERBOSE,
            )
            assert str(
                response["ResponseMetadata"]["HTTPStatusCode"]
            ) == "200" and f_u.shape == (n_users, K_VAL)
        except:
            return {
                "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
                "body": response["ResponseMetadata"],
            }
    else:
        try:
            response = update_table_vector(
                gradient_y_table, "user_id", user_id, "gradient_from_user", f_u
            )
            assert str(
                response["ResponseMetadata"]["HTTPStatusCode"]
            ) == "200" and f_u.shape == (n_users, K_VAL)
        except:
            return {
                "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
                "body": response["ResponseMetadata"],
            }

    ### Fonction d'aggrégation
    print(f_u)
    try:
        response = gradient_y_table.scan()
        items = response["Items"]
        print(items)
        user_id_list = list()
        for item in items:
            user_id_list.append(item["user_id"])
    except:
        return {
            "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
            "body": "Error getting f_u elements",
        }

    if len(user_id_list) >= THRESHOLD_UPDATE * n_users:
        ### Stochastic Gradient descent:
        Y = y_matrix.T  # (n_users, K_VAL)

        gradient_y_matrix = np.zeros(Y.shape)
        try:
            response = gradient_y_table.scan()
            items = response["Items"]
            print(items)
            for item in items:
                print(item)
                temp_matrix = np.array(json.loads(item["gradient_from_user"]))
                print(temp_matrix.shape)
                n_users_t, k_val_t = temp_matrix.shape
                assert k_val_t == K_VAL
                if n_users_t < n_users:
                    temp_matrix_right_shape = np.zeros(Y.shape)
                    temp_matrix_right_shape[:n_users_t, :] = temp_matrix
                else:
                    temp_matrix_right_shape = temp_matrix
                gradient_y_matrix = gradient_y_matrix + temp_matrix
            assert gradient_y_matrix.shape == (n_users, K_VAL)
        except:
            return {"statusCode": "400", "body": "Wrong f_u gradient shape"}

        ### Stochastic Gradient descent:
        gradient_y_matrix = -2 * gradient_y_matrix + 2 * LAMBDA_REG * Y
        Y = y_matrix.T  # (n_users, K_VAL)
        m, v = 0.0, 0.0
        for i in range(N_ITER_ADAM):
            m = BETA_1 * m + (1 - BETA_1) * gradient_y_matrix
            v = BETA_2 * v + (1 - BETA_2) * gradient_y_matrix**2
            m_hat = m / (1 - BETA_1)
            v_hat = v / (1 - BETA_2)
            Y = Y - GAMMA * m_hat / (np.sqrt(v_hat) + EPSILON)  # (n_users, K_VAL)
        print(Y)
        ### Update the weights in the matrix
        for i in range(n_users):
            update_table_vector(table_model_y, "user_id", str(i), "vector", Y[i, :])

    try:
        sort_index = np.argsort(inference_x.squeeze())
        sort_user_id_raw = list(
            map(
                lambda user_id: get_mapped(
                    demapping_table, "user_id", str(user_id), field_user_id_raw
                ),
                sort_index,
            )
        )

    except:
        return {"statusCode": "400", "body": "Error getting the ordered list"}

    return {
        "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
        "body": json.dumps(sort_user_id_raw),
    }


###### TEST: api_gateway_endpoint?user_id=2
###### Connexion between 2 LAMBDAS : Need to json.dumps() the dictonnary you're sending, but no need to json.loads to get it in the other lambda
