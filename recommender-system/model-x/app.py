"""This function is the User part of the model. It is supposed
to be in the device of the user in the long-term, but in the short-term
we compute it online since it is easier to implement this part in Python
than in Dart (the language of the app)."""
import os
import json
import boto3
import numpy as np
from helpers import put_item_vector_table, update_table_vector, get_item
from specific_helpers import compute_user_model_x

# Environment variables
RATINGS_TABLE_NAME = os.environ.get("RATINGS_TABLE_NAME")
USER_MODEL_X_TABLE_NAME = os.environ.get("USER_MODEL_X_TABLE_NAME")
ALPHA = float(os.environ.get("ALPHA"))
LAMBDA_REG = float(os.environ.get("LAMBDA_REG"))
VERBOSE = bool(os.environ.get("VERBOSE"))

assert (
    ALPHA is not None
    and LAMBDA_REG is not None
)

# Get the service resource
client_dynamodb = boto3.resource("dynamodb")
# Access the desired table resource
table_model_x = client_dynamodb.Table(USER_MODEL_X_TABLE_NAME)
table_implicit_feedbacks_R = client_dynamodb.Table(RATINGS_TABLE_NAME)

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


def get_x_u_model_vector(table, key_name, key, item_name, data_axis):
    """Return the user_id row of the X matrix latent factor
    X is the local-user part of the model.
    """
    x_u_json_vector = get_item(table, key_name, key, item_name)
    try:
        return transform_json_vector_to_matrix(x_u_json_vector, data_axis)
    except:
        print("Error in the x_u type got in the X model table")


def get_rating_vector_user(table, key_name, key, item_name, data_axis):
    """Return the user_id row of the R matrix.
    The R matrix is the matrix containing all the implicit feedback
    in the form of a mark.
    """
    rating_user_vector = get_item(table, key_name, key, item_name)
    try:
        return transform_json_vector_to_matrix(rating_user_vector, data_axis)
    except:
        print("Error in the R_u type got in the R mark matrix")


def handler(event, _context):
    """Simulate the X-User part of the Federated Collaborative Filtering Model
    Compute :
    - Update of the X-User Model
    - Partial gradient of Y

    Parameters:
        - user_id
        - K_VAL
        - n_users
        - y_matrix
    Returns:
        A HTTP response with the result of the operation (success or not):
        - "StatusCode"
        - "body"
        In case of sucess, the body contains in a json format:
        - The partial gradient of y_matrix (the Master Model)
        - The inference (the user preferences)
    """
    print("Event: ", event)
    # Variables
    k_val = event.get("K_VAL")  # Int
    n_users = event.get("n_users")  # Int
    user_id = event.get("user_id")  # str
    y_matrix_list = event.get("y_matrix")
    if k_val is None or n_users is None or user_id is None or y_matrix_list is None:
        return {
            "statusCode": "400",
            "body": "Wrong data transfert between Lambda Y and User Model X",
        }

    try:
        y_matrix = np.array(y_matrix_list)
        assert (
            isinstance(user_id, str)
            and isinstance(k_val, int)
            and isinstance(n_users, int)
            and y_matrix.shape == (k_val, n_users)
        )
    except SyntaxError:
        return {
            "statusCode": "400",
            "body": "Wrong data format of y_matrix from Lambda Y Master Model",
        }
    except AssertionError:
        return {"statusCode": "400", "body": "Wrong data input type for Model X"}

    # Check if it is a new user:
    response = table_model_x.get_item(Key={"user_id": user_id})
    ### User creation
    if "Item" not in response:
        # Vector initialisation
        response = put_item_vector_table(
            table_model_x, "user_id", user_id, "vector", np.random.rand(k_val)
        )
        try:
            assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
        except AssertionError:
            return {
                "statusCode": "500",
                "body": "Error adding the user to the model X database",
            }

    x_u = get_x_u_model_vector(table_model_x, "user_id", user_id, "vector", data_axis=0)

    try:
        assert x_u.shape == (k_val, 1)
    except AttributeError:
        return {
            "statusCode": "500",
            "body": "Returned x_u element is not a np.darray vector",
        }
    except AssertionError:
        return {"statusCode": "501", "body": "Erroneous vector shape of x_u"}

    ### Inference
    # 1st step : Check if the matrix computation is possible
    # r_ui_pred = np.dot(x_u.T, Y[:,i])
    # (1,k_val)x(k_val,n_users) = # (1,n_users)   # Mark supposed to be >0, take absolute value ?

    # Recommendation/Mark Matrix R:
    ## Get R_u to update the user model X & compute the gradient of master model Y
    r_u = get_rating_vector_user(
        table_implicit_feedbacks_R, "user_id", user_id, "R_u", data_axis=1
    )
    try:
        # r_u.shape == (1, N_USERS)
        r_u = r_u[:, :n_users]  # (1, n_users)
        
    except AttributeError:
        return {
            "statusCode": "501",
            "body": "Returned r_u element is not a np.darray vector",
        }
    except AssertionError:
        return {"statusCode": "501", "body": "Erroneous vector shape of r_u"}

    # r_u.shape == (1, n_users). However, due to latence, potentially :
    # r_u.shape[0] > n_users from lambda y (new users subscription)

    # TODO : compare mapping and R_u users

    # User Model :
    # - Optimal x_u computation
    # - Inference computation
    # - Gradient computation
    # Reminder:
    # y_matrix.shape == (k_val, n_users), r_u.shape == (1, n_users), x_u.shape == (k_val, 1)
    optimal_x_u, inference_x, f_u = compute_user_model_x(
        y_matrix, x_u, r_u, k_val, ALPHA, LAMBDA_REG
    )

    try:
        assert f_u.shape == (n_users, k_val)
    except AttributeError:
        return {
            "statusCode": "501",
            "body": "Returned partiel gradient element f_u is not a np.darray vector",
        }
    except AssertionError:
        return {"statusCode": "501", "body": "Erroneous vector shape of f_u"}

    try:
        assert optimal_x_u.shape == (k_val, 1)
    except AttributeError:
        return {
            "statusCode": "501",
            "body": "Returned optimal_x_u element is not a np.darray vector",
        }
    except AssertionError:
        return {"statusCode": "501", "body": "Erroneous vector shape of optimal_x_u"}

    # Update of the User-Model X in the AWS DynamoDB Table
    response = update_table_vector(
        table_model_x, "user_id", user_id, "vector", optimal_x_u.squeeze()
    )
    try:
        assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
    except AssertionError:
        return {
            "statusCode": "501",
            "body": "Error updating the model X - row user_id database",
        }

    return json.dumps(
        {"inference_x": inference_x.tolist(), "f_u": f_u.tolist()},
        separators=(",", ":"),
        sort_keys=True,
        indent=4,
    )
