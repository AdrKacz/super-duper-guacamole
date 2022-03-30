"""This function provides helpers functions
to alleviate the complexity of the main code."""
import json
from botocore.exceptions import ClientError


def put_item_table(table, key_name, key, item_name, item):
    """Put an item in the input AWS DynamoDB table

    Parameters:
        table: The AWS DynamoDB table
        key_name: The name of the key field in the table. Ex: "user_id"
        key: The key name, in a string format
        item_name: The name of the item you want to create
        item: The item to put in the table

    Returns:
        response : HTTP response
    """
    response = table.put_item(Item={key_name: key, item_name: item})
    return response


def put_item_vector_table(table, key_name, key, item_name, vector):
    """Put a vector in the input AWS DynamoDB table

    Parameters:
        table: The AWS DynamoDB table
        key_name: The name of the key field in the table. Ex: "user_id"
        key: The key name, in a string format
        item_name: The name of the item you want to create
        vector: The vector to put in the table

    Returns:
        response : HTTP response
    """
    return put_item_table(
        table,
        key_name,
        key,
        item_name,
        json.dumps(vector.tolist(), separators=(",", ":"), sort_keys=True, indent=4),
    )


def update_table(table, key_name, key_value, item_name, update_item):
    """Update an item in the input AWS DynamoDB table

    Parameters:
        table: The AWS DynamoDB table
        key_name: The name of the key field in the table. Ex: "user_id"
        key: The key name, in a string format
        item_name: The name of the item you want to update
        update_item: The item update value

    Returns:
        response : HTTP response
    """
    try:
        response = table.update_item(
            Key={key_name: key_value},
            UpdateExpression="SET {} = :update_item".format(item_name),
            ExpressionAttributeValues={":update_item": update_item},
        )
    except ClientError as event:
        print(event.response["Error"]["Message"])
    else:
        return response


def update_table_vector(table, key_name, key_value, item_name, update_vector):
    """Update a vector-item in the input AWS DynamoDB table

    Parameters:
        table: The AWS DynamoDB table
        key_name: The name of the key field in the table. Ex: "user_id"
        key: The key name, in a string format
        item_name: The name of the item you want to update
        update_vector: The vector update value

    Returns:
        response : HTTP response
    """
    response = update_table(
        table,
        key_name,
        key_value,
        item_name,
        json.dumps(
            update_vector.tolist(), separators=(",", ":"), sort_keys=True, indent=4
        ),
    )
    return response


def get_item(table, key_name, key, item_name):
    """Get an item from the input AWS DynamoDB table

    Parameters:
        table: The AWS DynamoDB table
        key_name: The name of the key field in the table. Ex: "user_id"
        key: The key name, in a string format
        item_name: The name of the item you want to get

    Returns:
        response : The corresponding item or None if not found
    """
    try:
        response = table.get_item(Key={key_name: str(key)})
    except ClientError as event:
        print(event.response["Error"]["Message"])
    else:
        return response["Item"][item_name]
