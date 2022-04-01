"""This function creates a mapping between the user id (raw)
and a mathematical id used for the model computation (matrix calculus)"""
import os
from urllib import parse
import boto3
from helpers import put_item_table, update_table, get_item

# Get the service resource.
client_dynamodb = boto3.resource("dynamodb")
# Access the desired table resource
mapping_table = client_dynamodb.Table("awa-mapping-table")
demapping_table = client_dynamodb.Table("awa-demapping-table")
# Define the client to interact with AWS Lambda
client_lambda = boto3.client("lambda")

# Environment variables
ARN_LAMBDA_MAPPING = os.environ.get("ARN_LAMBDA_MAPPING")
assert ARN_LAMBDA_MAPPING is not None

# Field names
USER_ID_RAW = "user_id_raw"
USER_ID = "user_id"
USER_INPUT_STRING = "userid"
MAX = "max"
RAW_QUERY_STRING = "rawQueryString"


def get_mapped(table, key_name, key, field_name):
    """Get the mapped id of an input user id: Either
    user_id_raw --> user_id
    user_id --> user_id_raw

    Parameters:
        table: The AWS DynamoDB table
        key_name: The name of the key field in the table. Ex: "user_id_raw"
        key: The key, in a string format
        field_name: The name of the item you want to get. Ex: "user_id"

    Returns:
        response : The mapped id
    """
    return get_item(table, key_name, key, field_name)


def handler(event, _context):
    """Create mapped ids for an input user id: Both
    user_id_raw --> user_id, and
    user_id --> user_id_raw

    Parameters to put in the URL:
        api_gateway_endpoint?USER_INPUT_STRING=abcd

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

    url_parsed = parse.parse_qs(raw_query_string)  # {USER_INPUT_STRING:['2']}
    user_id_raw_list_string = url_parsed.get(USER_INPUT_STRING)
    if user_id_raw_list_string is None:
        return {
            "statusCode": "400",
            "body": "Wrong spelling of 'userid' in the HTTP request",
        }

    user_id_raw = "".join(user_id_raw_list_string)
    # Mapping & DeMapping Tables - Check if it is a new user
    response = mapping_table.get_item(Key={USER_ID_RAW: user_id_raw})
    if "Item" not in response:
        # User creation - Mapping Table
        max_mapped_plus = 1 + int(get_mapped(mapping_table, USER_ID_RAW, MAX, USER_ID))
        response = put_item_table(
            mapping_table,
            USER_ID_RAW,
            user_id_raw,
            USER_ID,
            max_mapped_plus,
        )
        response = update_table(
            mapping_table, USER_ID_RAW, MAX, USER_ID, max_mapped_plus
        )

        # User creation - De-Mapping Table
        response = put_item_table(
            demapping_table,
            USER_ID,
            str(max_mapped_plus),
            USER_ID_RAW,
            user_id_raw,
        )

    return {
        "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
        "body": "Mapping succeeded",
    }
