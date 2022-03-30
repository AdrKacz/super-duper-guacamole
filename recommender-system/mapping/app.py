import json
import boto3
import os
from urllib import parse
from botocore.exceptions import ClientError

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


def put_item_table(table, key_name, key, item_name, item, verbose=False):
    response = table.put_item(Item={key_name: key, item_name: item})
    if verbose:
        print(response)
    return response


def update_table(table, key_name, key_value, item_name, update_item):
    """Function to update the corresponding vector of as row of id:key_value in a table"""
    try:
        response = table.update_item(
            Key={key_name: key_value},
            UpdateExpression="SET {} = :update_item".format(item_name),
            ExpressionAttributeValues={":update_item": update_item},
        )
    except ClientError as e:
        print(e.response["Error"]["Message"])
    else:
        return response


def get_method(table, key_name, key, field_name):
    try:
        response = table.get_item(Key={key_name: key})
    except ClientError as e:
        print(e.response["Error"]["Message"])
    else:
        return response["Item"][field_name]


def get_mapped(table, key_name, key, field_name):
    return get_method(table, key_name, key, field_name)


def handler(event, context):
    print(
        "Event: ", event
    )  #  api_gateway_endpoint?user_id=2_36&ids_nb_messages=(3,12),(4,32)
    try:
        # Variables
        print(event["rawQueryString"])
        url_parsed = parse.parse_qs(event["rawQueryString"])  # {'user_id':['2']}
        user_id_raw = "".join(url_parsed["user_id"])
    except:
        return {"statusCode": "400", "body": "Wrong data input type for R update"}
    # (De)Mapping Tables - Check if it is a new user
    response = mapping_table.get_item(Key={"user_id_raw": user_id_raw})
    if "Item" not in response:
        # User creation - Mapping Table
        max_mapped_plus = 1 + int(
            get_mapped(mapping_table, "user_id_raw", "max", "user_id")
        )
        response = put_item_table(
            mapping_table,
            "user_id_raw",
            user_id_raw,
            "user_id",
            max_mapped_plus,
            verbose=False,
        )
        response = update_table(
            mapping_table, "user_id_raw", "max", "user_id", max_mapped_plus
        )

        # User creation - De-Mapping Table
        response = put_item_table(
            demapping_table,
            "user_id",
            str(max_mapped_plus),
            "user_id_raw",
            user_id_raw,
            verbose=False,
        )

    return {
        "statusCode": response["ResponseMetadata"]["HTTPStatusCode"],
        "body": "Mapping succeeded",
    }


##### TEST: api_gateway_endpoint?user_id=abcd
