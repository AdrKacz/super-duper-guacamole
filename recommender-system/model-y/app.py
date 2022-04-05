"""This function provides a recommendation list to the user
to create a conversation with appropriate people for him."""
import os
import json
from urllib import parse
import boto3
import numpy as np
from botocore.exceptions import ClientError
from helpers import put_item_vector_table, update_table_vector, get_item
from specific_helpers import (
    get_y_matrix_reconstructed,
    get_gradient_y_matrix_reconstructed,
    compute_stochastic_grad_descent,
)

# Environment variables
MAPPING_TABLE_NAME = os.environ.get("MAPPING_TABLE_NAME")
DEMAPPING_TABLE_NAME = os.environ.get("DEMAPPING_TABLE_NAME")
MASTER_MODEL_Y_TABLE_NAME = os.environ.get("MASTER_MODEL_Y_TABLE_NAME")
GRADIENT_Y_TABLE_NAME = os.environ.get("GRADIENT_Y_TABLE_NAME")
ARN_LAMBDA_X = os.environ.get("ARN_LAMBDA_X")

K_VAL = int(os.environ.get("K_VAL"))
N_ITER_ADAM = int(os.environ.get("N_ITER_ADAM"))
GAMMA = float(os.environ.get("GAMMA"))
BETA_1 = float(os.environ.get("BETA_1"))
BETA_2 = float(os.environ.get("BETA_2"))
EPSILON = float(os.environ.get("EPSILON"))
LAMBDA_REG = float(os.environ.get("LAMBDA_REG"))
THRESHOLD_UPDATE = float(os.environ.get("THRESHOLD_UPDATE"))
VERBOSE = bool(os.environ.get("VERBOSE"))
assert K_VAL is not None and ARN_LAMBDA_X is not None

# Get the service resource.
client_dynamodb = boto3.resource("dynamodb")
# Access the desired table resource
table_model_y = client_dynamodb.Table(MASTER_MODEL_Y_TABLE_NAME)
mapping_table = client_dynamodb.Table(MAPPING_TABLE_NAME)
demapping_table = client_dynamodb.Table(DEMAPPING_TABLE_NAME)
gradient_y_table = client_dynamodb.Table(GRADIENT_Y_TABLE_NAME)
# Define the client to interact with AWS Lambda
client_lambda = boto3.client("lambda")


# Field names
USER_ID_RAW = "user_id_raw"
USER_ID = "user_id"
USER_INPUT_STRING = "userid"
RAW_QUERY_STRING = "rawQueryString"


def transform_json_vector_to_matrix(json_vector, data_axis):
    """Transform a vector saved in a list form in a json object
    to a double dimension np.ndarray (a matrix)"""
    vector = np.array(json.loads(json_vector))
    try:
        assert data_axis in (0, 1)
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
    except ClientError as event:
        print(event.response["Error"]["Message"])
    else:
        return response["Item"][field_name]


def handler(event, _context):
    print("Event: ", event)

    # Get user_id_raw
    raw_query_string = event.get(RAW_QUERY_STRING)
    if raw_query_string is None:
        return {
            "statusCode": "400",
            "body": "rawQueryString not in the URL parameters of the HTTP request",
        }
    url_parsed = parse.parse_qs(raw_query_string)
    print(url_parsed)
    user_id_raw_list_string = url_parsed.get(USER_INPUT_STRING)
    if user_id_raw_list_string is None:
        return {
            "statusCode": "400",
            "body": "Wrong spelling of 'userid' in the HTTP request",
        }
    user_id_raw = "".join(user_id_raw_list_string)

    # Get Mapped id:
    #### Modify 
    user_id = str(get_mapped(mapping_table, USER_ID_RAW, user_id_raw, USER_ID))
    print(user_id)
    response = table_model_y.get_item(Key={USER_ID: user_id})

    # Does user exists ? If not --> Create user
    if "Item" not in response:
        try:
            response = put_item_vector_table(
                table_model_y, USER_ID, user_id, "vector", np.random.rand(K_VAL)
            )
            print(response)
            assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
        except:
            return {
                "statusCode": "500",
                "body": "Error adding the user to the model Y database",
            }

    # Get/Reconstruct the Y matrix of the Master Model
    max_mapped = int(get_mapped(mapping_table, USER_ID_RAW, "max", USER_ID))
    n_users = max_mapped + 1
    try:
        response = table_model_y.scan()
        items = response["Items"]
    except ClientError as event:
        print(event.response["Error"]["Message"])
        return {
            "statusCode": "400",
            "body": "Error getting Y matrix elements with .scan()",
        }

    y_matrix = get_y_matrix_reconstructed(
        items, max_mapped, K_VAL, USER_ID
    )  # (K_VAL, n_users)

    # Interact with the AWS Lambda of the User-X Part of the model
    # Define the input parameters that will be passed on to the Lambda X function
    input_x = json.dumps(
        {
            USER_ID: user_id,
            "y_matrix": y_matrix.tolist(),
            "K_VAL": K_VAL,
            "n_users": n_users,
        },
        separators=(",", ":"),
        sort_keys=True,
        indent=4,
    )
    # Invoke of the Lambda of User-X Part of the model
    response = client_lambda.invoke(
        FunctionName=ARN_LAMBDA_X, InvocationType="RequestResponse", Payload=input_x
    )
    print("Response : ", response)

    try:
        assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
    except AssertionError:
        return {"statusCode": "400", "body": "Error returned by the Lambda X"}

    x_response = response["Payload"].read()
    x_json_1 = json.loads(x_response)
    print("PayLoad :", x_response)

    try:
        x_json_2 = json.loads(x_json_1)
        print("PayLoad JSON:", x_json_2)
    except TypeError:
        print("Error - Lambda X did not return a JSON embedded in a JSON")
        return {"statusCode": x_json_1["statusCode"], "body": x_json_1["body"]}

    # Check of inference_x, set to the right type
    try:
        inference_x = np.array(x_json_2["inference_x"])
        assert inference_x.shape == (1, n_users)
    except AttributeError:
        return {
            "statusCode": "500",
            "body": "Returned inference_x element is not a np.darray vector",
        }
    except AssertionError:
        return {"statusCode": "501", "body": "Erroneous vector shape of x_u"}
    except:
        return {
            "statusCode": "400",
            "body": "Error while passing inference_x to np.ndarray format",
        }

    # Check of federated_gradient, set to the right type
    try:
        f_u = np.array(x_json_2["f_u"])
        assert f_u.shape == (n_users, K_VAL)
    except AttributeError:
        return {
            "statusCode": "500",
            "body": "Returned inference_x element is not a np.darray vector",
        }
    except AssertionError:
        return {"statusCode": "501", "body": "Erroneous vector shape of x_u"}
    except:
        return {
            "statusCode": "400",
            "body": "Error while passing f_u to np.ndarray format",
        }

    # Aggregate the client's gradient
    # Save federated partial gradient in the gradient table:
    response = gradient_y_table.get_item(Key={USER_ID: user_id})
    print("Response Y gradient :", response)
    if "Item" not in response:
        try:
            response = put_item_vector_table(
                gradient_y_table, USER_ID, user_id, "gradient_from_user", f_u
            )
            assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
        except AssertionError:
            return {
                "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
                "body": response["ResponseMetadata"],
            }
    else:
        try:
            response = update_table_vector(
                gradient_y_table, USER_ID, user_id, "gradient_from_user", f_u
            )
            assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
        except AssertionError:
            return {
                "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
                "body": response["ResponseMetadata"],
            }

    # Check of the number of partial gradient the table contains
    print(f_u)
    try:
        response = gradient_y_table.scan()
        items = response["Items"]
        print(items)
        user_id_list = list()
        for item in items:
            user_id_list.append(item[USER_ID])
    except:
        return {
            "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
            "body": "Error getting f_u elements",
        }

    # If the number of partial gradient contained in the table exceeds a threshold,
    # then we proceed to the Y matrix update through the Stochastic Gradient descent
    if len(user_id_list) >= THRESHOLD_UPDATE * n_users:
        # Aggregate Gradient Y Matrix
        y_mat_transposed = y_matrix.T  # (n_users, K_VAL)
        try:
            response = gradient_y_table.scan()
            items = response["Items"]
        except:
            return {"statusCode": "500", "body": "Wrong f_u gradient shape"}
        print(items)

        # Gradient Y Matrix aggregation function
        gradient_y_matrix = get_gradient_y_matrix_reconstructed(
            items, max_mapped, n_users, K_VAL, USER_ID
        )

        try:
            assert gradient_y_matrix.shape == (n_users, K_VAL)
        except AssertionError:
            return {
                "statusCode": "500",
                "body": "Error while reconstructing gradient Y matrix",
            }

        # Stochastic Gradient descent
        y_mat_transposed = compute_stochastic_grad_descent(
            y_mat_transposed,
            gradient_y_matrix,
            LAMBDA_REG,
            BETA_1,
            BETA_2,
            GAMMA,
            EPSILON,
            N_ITER_ADAM,
        )

        print(y_mat_transposed)
        # Update the weights in the matrix
        for i in range(n_users):
            update_table_vector(
                table_model_y, USER_ID, str(i), "vector", y_mat_transposed[i, :]
            )

    try:
        sort_index = np.argsort(inference_x.squeeze())
        sort_user_id_raw = list(
            map(
                lambda user_id: get_mapped(
                    demapping_table, USER_ID, str(user_id), USER_ID_RAW
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


###### Connexion between 2 LAMBDAS : Need to json.dumps() the dictonnary you're sending, but no need to json.loads to get it in the other lambda
