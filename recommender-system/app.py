import boto3
import numpy as np
import json
import os

# Get the service resource.
dynamodb = boto3.resource('dynamodb')
# Access the desired table resource
db_model_y = dynamodb.Table('awa-model-y')
# Define the client to interact with AWS Lambda
client_lambda = boto3.client('lambda')

# Environment variables
K_VAL = int(os.environ.get('K_VAL'))
N_USERS = int(os.environ.get('N_USERS'))
ARN_LAMBDA_X = os.environ.get('ARN_LAMBDA_X')
assert K_VAL != None and N_USERS != None and ARN_LAMBDA_X != None

def get_matrix_y(db, key_name, key_value, attribute_value):
    """Function to get the Y matrix from the database"""
    response = db.get_item(Key={key_name: key_value})
    item = response['Item']
    return np.array(json.loads(item[attribute_value]))

def update_y_matrix(db, key_name, key_value, matrix_y_update):
    """Function to update the Y matrix in the database - 1st version"""
    db.update_item(Key={key_name: key_value},
    UpdateExpression='SET matrix = :matrix_update',
    ExpressionAttributeValues={':matrix_update': json.dumps(matrix_y_update.tolist(), separators=(',', ':'), sort_keys=True, indent=4)})

def handler(event, context):
    print("Event: ", event)
    update_y_bool = bool(event['update'])
    user_id = event["user_id"]
    try:
        assert type(user_id)==str and type(update_y_bool) == bool
    except:
        return "ERROR 203"
    matrix_y_update = np.random.rand(K_VAL, N_USERS)
    # Variables
    user_id = event["user_id"] # 1

    if update_y_bool:
        update_y_matrix(db_model_y, 'user_id', 'matrix_y', matrix_y_update)

    #### Get item matrix_y from the table (the Y matrix)
    y_matrix = get_matrix_y(db_model_y, 'user_id', 'matrix_y', 'matrix')
    try:
        assert isinstance(y_matrix, np.ndarray) and y_matrix.shape == (K_VAL, N_USERS)
    except:
        return "ERROR 204"

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

    return json.dumps({'user_id' : user_id_x,
            'inference_x' : inference_x.tolist()},
             separators=(',', ':'), sort_keys=True, indent=4)

###### Connexion between 2 LAMBDAS : Need to json.dumps() the dictonnary you're sending, but no need to json.loads to get it in the other lambda !!