"""For a given user ID(u), compute and post rates for other user IDs.
Currently, the rate is computed given the number of messages exchanged
by u in a conversation with others users. This number of message is
compared to the moving average of messages exchanged by u, to compute a rate.
This rate will be the rate u give to the conversation, so to the other users.
"""
import os
import json
from urllib import parse
from decimal import Decimal
import boto3
import numpy as np
from helpers import update_table_vector, get_item, update_table
from specific_helpers import exponential_average, compute_r_u_vector_updated

# Get the service resource.
client_dynamodb = boto3.resource("dynamodb")
# Access the desired table resource
table_implicit_feedbacks_R = client_dynamodb.Table("awa-implicit-feedback-R")
mapping_table = client_dynamodb.Table("awa-mapping-table")
demapping_table = client_dynamodb.Table("awa-demapping-table")
# Define the client to interact with AWS Lambda
client_lambda = boto3.client("lambda")

# Environment variables
N_USERS_MAX = int(os.environ.get("N_USERS"))
ARN_LAMBDA_USERS_MARKS_R = os.environ.get("ARN_LAMBDA_R")
TIME_REFRESH_CONSTANT = Decimal(os.environ.get("TIME_REFRESH_CONSTANT"))
assert N_USERS_MAX is not None and ARN_LAMBDA_USERS_MARKS_R is not None

# Field names
USER_ID_RAW = "user_id_raw"
USER_ID = "user_id"
USER_INPUT_STRING = "userid"
USERS_MESSAGES_OTHERS_USERS = "ids-messages"
RAW_QUERY_STRING = "rawQueryString"


def create_new_user(
    table, key_name, key, field_name, vector_value, field_name_2, value_2
):
    """ "Create new user row within the R table, with all marks sets to 0."""
    table.put_item(
        Item={
            key_name: key,
            field_name: json.dumps(
                vector_value.tolist(), separators=(",", ":"), sort_keys=True, indent=4
            ),
            field_name_2: value_2,
        }
    )


def get_rating_vector_vector(table, key_name, key, item_name):
    """Return the user_id row of the X matrix latent factor
    X is the local-user part of the model.
    """
    x_u_json_vector = get_item(table, key_name, key, item_name)
    try:
        return np.array(json.loads(x_u_json_vector))
    except:
        print("Error in the r_u type got in the X model table")


def get_mapped(table, key_name, key, field_name):
    return get_item(table, key_name, key, field_name)


def handler(event, _context):
    """For a given user ID(u), compute and post rates for other user IDs.
    Currently, the rate is computed given the number of messages exchanged
    by u in a conversation with others users. This number of message is
    compared to the moving average of messages exchanged by u, to compute a rate.
    This rate will be the rate u give to the conversation, so to the other users."""

    """Create or update ratings ofids for an input user id: Both
    user_id_raw --> user_id, and
    user_id --> user_id_raw

    Parameters to put in the URL:
        api_gateway_endpoint?USER_INPUT_STRING=2-36&USERS_MESSAGES_OTHERS_USERS=(abcd,12)-(bcde,32)
        Ex:
        api_gateway_endpoint?userid=2-36&ids-messages=(abcd,12)-(bcde,32)

    Returns:
        A HTTP response with the result of the operation (success or not):
        - "StatusCode"
        - "body"
    """
    print("Event: ", event)
    raw_query_string = event.get(RAW_QUERY_STRING)
    print(raw_query_string)
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
    user_id_nb_messages_raw = url_parsed[USER_INPUT_STRING][0].split("-")
    try:
        user_id_raw, nb_messages = user_id_nb_messages_raw[0], int(
            user_id_nb_messages_raw[1]
        )
    except ValueError:
        return {
            "statusCode": "400",
            "body": "Wrong delimitator or input number of messages is not an integer",
        }

    users_ids_messages_list_string = url_parsed.get(USERS_MESSAGES_OTHERS_USERS)
    if users_ids_messages_list_string is None:
        return {
            "statusCode": "400",
            "body": "Wrong spelling of 'userid' in the HTTP request",
        }
    str_ids_nb_messages = users_ids_messages_list_string[0]

    try:
        clean_list_raw_id_nb_message = list(
            map(
                lambda x: x.replace("(", "").replace(")", "").split(","),
                str_ids_nb_messages.split("-"),
            )
        )
    except ValueError:
        return {
            "statusCode": "400",
            "body": "Wrong delimitators for userids and messages numbers",
        }

    print(clean_list_raw_id_nb_message)

    try:
        clean_dict_id_nb_message = dict(
            map(
                lambda x: (
                    int(get_mapped(mapping_table, USER_ID_RAW, x[0], USER_ID)),
                    int(x[1]),
                ),
                clean_list_raw_id_nb_message,
            )
        )
    except ValueError:
        return {
            "statusCode": "400",
            "body": "Wrong data input type (number of messages are not integers or mapped id is not an integer",
        }
    except TypeError:
        return {"statusCode": "400", "body": "Error getting mapped ids with get_mapped"}
    print(clean_dict_id_nb_message)

    #### Get Mapped id
    try:
        user_id_int = get_mapped(mapping_table, USER_ID_RAW, user_id_raw, USER_ID)
        assert isinstance(user_id_int, int)
    except AssertionError:
        return {
            "statusCode": "400",
            "body": "Error getting mapped id",
        }
    user_id = str(user_id_int)

    # R table (rating table) - Check if it is a new user
    response = table_implicit_feedbacks_R.get_item(Key={USER_ID: user_id})
    if "Item" not in response:
        # User creation - Initialisation of the notation
        create_new_user(
            table_implicit_feedbacks_R,
            USER_ID,
            user_id,
            "R_u",
            np.zeros(N_USERS_MAX),
            "exponential_avg",
            None,
        )

    ### R_u update:
    else:
        exponential_avg = get_item(
            table_implicit_feedbacks_R, USER_ID, user_id, "exponential_avg"
        )
        print("type exponential_avg", exponential_avg, type(exponential_avg))
        print(
            "type TIME_REFRESH_CONSTANT",
            TIME_REFRESH_CONSTANT,
            type(TIME_REFRESH_CONSTANT),
        )
        if exponential_avg is not None:
            exponential_avg = exponential_average(
                nb_messages, exponential_avg, TIME_REFRESH_CONSTANT
            )
            print("Exponential avg update")
        else:
            exponential_avg = nb_messages
            print("Exponential avg setup")

        print("type exponential_avg", type(exponential_avg))
        exponential_avg = Decimal(exponential_avg)
        print("type nb_messages", type(nb_messages))
        mark = Decimal(nb_messages / exponential_avg)
        print("Mark :", mark)

        # Compute the update of the rating vector
        rating_vector = get_rating_vector_vector(table_implicit_feedbacks_R, USER_ID, user_id, "R_u")
        rating_vector = compute_r_u_vector_updated(rating_vector, clean_dict_id_nb_message, mark)

        # Updates
        # Update exponential average
        response = update_table(
            table_implicit_feedbacks_R,
            USER_ID,
            user_id,
            "exponential_avg",
            exponential_avg,
        )
        # Update rating vector
        response = update_table_vector(
            table_implicit_feedbacks_R, USER_ID, user_id, "R_u", rating_vector
        )
    return {"statusCode": "200", "body": "Update succeeded"}
