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
    '''Function to get the Y matrix from the database'''
    response = table.get_item(Key={key_name: key_value})
    item = response['Item']
    return np.array(json.loads(item[attribute_value]))

def update_y_matrix(table, key_name, key_value, matrix_y_update):
    '''Function to update the Y matrix in the database - 1st version'''
    table.update_item(Key={key_name: key_value},
    UpdateExpression='SET matrix = :matrix_update',
    ExpressionAttributeValues={':matrix_update': json.dumps(matrix_y_update.tolist(), separators=(',', ':'), sort_keys=True, indent=4)})

def handler(event, context):
    print('Event: ', event)  #  api_gateway_endpoint?user_id=2
    # Variables
    update_y_bool = True    # bool(event['update'])
    try:
        print(event['rawQueryString']) # 'user_id=2'
        url_parsed = parse.parse_qs(event['rawQueryString'])  # {'user_id':['2']}
        user_id = ''.join(url_parsed['user_id'])
        assert isinstance(int(user_id),int) and isinstance(user_id,str) and isinstance(update_y_bool, bool)
    except:
        return {'statusCode': '400',
            'body': 'Wrong data types'}

    matrix_y_update = np.random.rand(K_VAL, N_USERS)
    if update_y_bool:
        update_y_matrix(table_model_y, 'user_id', 'matrix_y', matrix_y_update)

    #### Get item matrix_y from the table (the Y matrix)
    try:
        y_matrix = get_matrix_y(table_model_y, 'user_id', 'matrix_y', 'matrix')
        assert y_matrix.shape == (K_VAL, N_USERS)
    except:
        return {'statusCode': '400',
            'body': 'Wrong matrix Y shape'}

    ### Interaction with the AWS lambda of the x-part of the model (users)
    # Define the input parameters that will be passed on to the model x function
    input_x = json.dumps({'user_id' : user_id,
               'y_matrix': y_matrix.tolist(),
               'K_VAL': K_VAL,
               'N_USERS': N_USERS}
               , separators=(',', ':'), sort_keys=True, indent=4)

    response = client_lambda.invoke(
        FunctionName = ARN_LAMBDA_X,
        InvocationType = 'RequestResponse',
        Payload = input_x)
    print('Response : ', response)
    try:
        assert str(response['ResponseMetadata']['HTTPStatusCode'])=='200'
    except:
        return {'statusCode': '400',
            'body': 'Error returned by the Lambda X'}
    else:
        x_response = response['Payload'].read()
        x_json_1 = json.loads(x_response)
        print('PayLoad :', x_response)

    try:      
        x_json_2 = json.loads(x_json_1)
        print('PayLoad JSON:', x_json_2)
        user_id_x = x_json_2['user_id']
    except:
        return {'statusCode': x_json_1['statusCode'],
            'body': x_json_1['body']}

    try:
        inference_x = np.array(x_json_2['inference_x'])
        assert user_id_x == user_id and inference_x.shape == (1,N_USERS)
    except:
        return {'statusCode': '400',
            'body': 'Wrong inference format'}

    return {'statusCode': response['ResponseMetadata']['HTTPStatusCode'],
            'body': json.dumps(inference_x.tolist())}

#### ##### TEST: api_gateway_endpoint?user_id=2
###### Connexion between 2 LAMBDAS : Need to json.dumps() the dictonnary you're sending, but no need to json.loads to get it in the other lambda !!