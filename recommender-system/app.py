import boto3
import numpy as np
import json
import os
from urllib import parse

# Get the service resource.
client_dynamodb = boto3.resource('dynamodb')
# Access the desired table resource
table_model_y = client_dynamodb.Table('awa-model-y')
# Define the client to interact with AWS Lambda
client_lambda = boto3.client('lambda')

# Environment variables
K_VAL = int(os.environ.get('K_VAL'))
N_USERS = int(os.environ.get('N_USERS'))
ARN_LAMBDA_X = os.environ.get('ARN_LAMBDA_X')
assert K_VAL != None and N_USERS != None and ARN_LAMBDA_X != None

def get_matrix_y(table, key_name, key_value, attribute_value):
    """Function to get the Y matrix from the database"""
    response = table.get_item(Key={key_name: key_value})
    item = response['Item']
    return np.array(json.loads(item[attribute_value]))

def update_y_matrix(table, key_name, key_value, matrix_y_update):
    """Function to update the Y matrix in the database - 1st version"""
    table.update_item(Key={key_name: key_value},
    UpdateExpression='SET matrix = :matrix_update',
    ExpressionAttributeValues={':matrix_update': json.dumps(matrix_y_update.tolist(), separators=(',', ':'), sort_keys=True, indent=4)})

def handler(event, context):
    print("Event: ", event)
    # event = json.loads(event)
    # Variables
    update_y_bool = True    #bool(event['update'])
    try:
        print(event["rawQueryString"])
        url_parsed = parse.parse_qs(event["rawQueryString"])
        print(url_parsed)
        user_id = "".join(url_parsed["user_id"])
        assert type(int(user_id))==int and type(update_y_bool) == bool
    except:
        return {'statusCode': '400',
            'body': "Wrong data types"}

    matrix_y_update = np.random.rand(K_VAL, N_USERS)

    if update_y_bool:
        update_y_matrix(table_model_y, 'user_id', 'matrix_y', matrix_y_update)

    #### Get item matrix_y from the table (the Y matrix)
    y_matrix = get_matrix_y(table_model_y, 'user_id', 'matrix_y', 'matrix')
    try:
        assert isinstance(y_matrix, np.ndarray) and y_matrix.shape == (K_VAL, N_USERS)
    except:
        return {'statusCode': '400',
            'body': "Wrong model"}

    ### Interaction with the AWS lambda of the x-part of the model (users)
    # Define the input parameters that will be passed on to the model x function
    input_x = json.dumps({"user_id" : user_id,
               "y_matrix": y_matrix.tolist(),
               "K_VAL": K_VAL}
               , separators=(',', ':'), sort_keys=True, indent=4)

    response = client_lambda.invoke(
        FunctionName = ARN_LAMBDA_X,
        InvocationType = 'RequestResponse',
        Payload = input_x)
    
    print("Response : ", response)
    x_response = response['Payload'].read()
    print("PayLoad :", x_response)

    x_json = json.loads(json.loads(x_response))
    print("PayLoad JSON:", x_json)
    user_id_x = x_json["user_id"]
    inference_x = np.array(x_json['inference_x'])
    print(inference_x.shape)

    return {'statusCode': response['ResponseMetadata']['HTTPStatusCode'],
            'body': json.dumps(inference_x.tolist())}

    # return json.dumps({'user_id' : user_id_x,
    #         'inference_x' : inference_x.tolist()},
    #          separators=(',', ':'), sort_keys=True, indent=4)

    # json.dumps({
    # "isBase64Encoded": False,
    # "statusCode": 200,
    # "body": "Hello from Lambda!",
    # "headers": {
    #     "content-type": "application/json"
    # }
    # })

##### Output format of a Lambda function for proxy integration
# {
#     "isBase64Encoded": true|false,
#     "statusCode": httpStatusCode,
#     "headers": { "headerName": "headerValue", ... },
#     "multiValueHeaders": { "headerName": ["headerValue", "headerValue2", ...], ... },
#     "body": "..."
# }


###### Connexion between 2 LAMBDAS : Need to json.dumps() the dictonnary you're sending, but no need to json.loads to get it in the other lambda !!