"""This function is the User part of the model. It is supposed
to be in the device of the user in the long-term, but in the short-term
we compute it online since it is easier to implement this part in Python
than in Dart (the language of the app)."""
import os
import json
import boto3
import numpy as np
from helpers import put_item_vector_table, update_table_vector, get_item

# Get the service resource.
client_dynamodb = boto3.resource("dynamodb")
# Access the desired table resource
table_model_x = client_dynamodb.Table("awa-model-x-users-simul")
table_implicit_feedbacks_R = client_dynamodb.Table("awa-implicit-feedback-R")

ARN_LAMBDA_USERS_MARKS_R = os.environ.get("ARN_LAMBDA_R")
ALPHA = float(os.environ.get("ALPHA"))
LAMBDA_REG = float(os.environ.get("LAMBDA_REG"))
VERBOSE = bool(os.environ.get("VERBOSE"))
assert (
    ARN_LAMBDA_USERS_MARKS_R is not None
    and ALPHA is not None
    and LAMBDA_REG is not None
)


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
    print("Event: ", event)
    try:
        # Variables
        k_val = event["K_VAL"]  # Int
        n_users = event["n_users"]  # Int
        user_id = event["user_id"]  # str
        y_matrix = np.array(event["y_matrix"])
        assert (
            isinstance(user_id, str)
            and isinstance(k_val, int)
            and isinstance(n_users, int)
            and y_matrix.shape == (k_val, n_users)
        )
    except:
        return {"statusCode": "400", "body": "Wrong data input type for Model X"}
    # Check if it is a new user:
    response = table_model_x.get_item(Key={"user_id": user_id})
    print(response)
    ### User creation
    if "Item" not in response:
        # Vector initialisation
        try:
            response = put_item_vector_table(
                table_model_x, "user_id", user_id, "vector", np.random.rand(k_val)
            )
            assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
        except:
            return {
                "statusCode": "500",
                "body": "Error adding the user to the model X database",
            }
    try:
        x_u = get_x_u_model_vector(
            table_model_x, "user_id", user_id, "vector", data_axis=0
        )  # Vector in a matrix shape (k_val,1)
        assert isinstance(x_u, np.ndarray)
    except:
        return {"statusCode": "500", "body": "AWS Server Error getting vector"}
    try:
        x_u.shape == (k_val, 1)
    except:
        return {"statusCode": "400", "body": "Wrong data x_u output"}

    ### Inference
    # 1st step : Check if the matrix computation is possible
    # r_ui_pred = np.dot(x_u.T, Y[:,i])
    # (1,k_val)x(k_val,n_users) = # (1,n_users)   # Mark supposed to be >0, take absolute value ?

    # Recommendation/Mark Matrix R:
    ## Get R_u to update the user model X & compute the gradient of master model Y
    try:
        r_u = get_rating_vector_user(
            table_implicit_feedbacks_R, "user_id", user_id, "R_u", data_axis=1
        )
        assert isinstance(r_u, np.ndarray)
        r_u = r_u[:, :n_users]  # (1, n_users)
    except:
        return {
            "statusCode": "500",
            "body": "Error getting implicit/explicti marks R_u of users user_id",
        }
    # r_u.shape == (1, n_users). However, due to latence, potentially :
    # r_u.shape[0] > n_users from lambda y (new users subscription)

    # compare mapping and R_u users

    # In the original paper federated learning is based on : p_ui = r_ui != 0.0==> p_ui in [0,1]
    # Here p_u = r_u, to keep the gradual information of the marks
    p_u = r_u  # (1,n_users)
    # c_ui = 1 + ALPHA*r_ui
    c_u = 1 + ALPHA * r_u  # (1,n_users)
    p_u_trans = p_u.T

    try:
        print(y_matrix.shape, r_u.shape, c_u.shape)
        assert (
            y_matrix.shape == (k_val, n_users)
            and r_u.shape == (1, n_users)
            and c_u.shape == (1, n_users)
            and p_u_trans.shape == (n_users, 1)
        )
        c_u_diag = np.diag(c_u.squeeze().tolist())
        assert c_u_diag.shape == (n_users, n_users)
        x_u_opt = np.dot(
            np.linalg.inv(y_matrix @ c_u_diag @ y_matrix.T + LAMBDA_REG * np.identity(k_val)),
            y_matrix @ c_u_diag @ p_u_trans,
        )
        print(x_u_opt.shape)
        assert x_u_opt.shape == (k_val, 1)
    except:
        return {
            "statusCode": "400",
            "body": "Wrong data shapes for x_u_opt computation ",
        }
    ### Update of the User-Model X

    try:
        response = update_table_vector(
            table_model_x, "user_id", user_id, "vector", x_u_opt.squeeze()
        )
        print(response)
        assert str(response["ResponseMetadata"]["HTTPStatusCode"]) == "200"
    except:
        return {
            "statusCode": "500",
            "body": "Error updating the model X - row user_id database",
        }

    inference_x = np.dot(x_u_opt.T, y_matrix)  # (1,n_users)
    print(inference_x)

    ### Gradient computation
    # Formally: y_i = y_i - gamma*dJ/dy_i
    try:
        print(c_u.shape, p_u_trans.shape, y_matrix.shape, x_u.shape)
        f_u = (c_u.T * (p_u_trans - y_matrix.T @ x_u)) @ x_u.T  # (n_users,k_val)
        print(f_u.shape)
        assert f_u.shape == (n_users, k_val)
    except:
        return {"statusCode": "500", "body": "Error computing f_u"}

    return json.dumps(
        {"inference_x": inference_x.tolist(), "f_u": f_u.tolist()},
        separators=(",", ":"),
        sort_keys=True,
        indent=4,
    )


##### TEST: Call Lambda Y
# Y = np.zeros((50,50))
# r_u = np.zeros((1,50))
# x_u = np.ones((50,1))
