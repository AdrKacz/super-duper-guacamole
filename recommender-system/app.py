import boto3
import numpy as np
import json
import os
from urllib import parse
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

# Get the service resource.
client_dynamodb = boto3.resource('dynamodb')
# Access the desired table resource
table_model_y = client_dynamodb.Table('awa-model-y')
mapping_table = client_dynamodb.Table('awa-mapping-table')
# Define the client to interact with AWS Lambda
client_lambda = boto3.client('lambda')

# Environment variables
K_VAL = int(os.environ.get('K_VAL'))
# N_USERS = int(os.environ.get('N_USERS'))
ARN_LAMBDA_X = os.environ.get('ARN_LAMBDA_X')
N_ITER_ADAM = int(os.environ.get('N_ITER_ADAM'))
GAMMA = float(os.environ.get('GAMMA'))
BETA_1 = float(os.environ.get('BETA_1'))
BETA_2 = float(os.environ.get('BETA_2'))
EPSILON = float(os.environ.get('EPSILON'))
VERBOSE = bool(os.environ.get('VERBOSE'))
assert K_VAL != None and ARN_LAMBDA_X != None
def get_user_id(event, query_string, verbose=False):
    if verbose:
        print(event[query_string]) # 'user_id=2'
    url_parsed = parse.parse_qs(event['rawQueryString'])  # {'user_id':['2']}
    user_id = ''.join(url_parsed['user_id'])
    assert isinstance(int(user_id),int) and isinstance(user_id,str)
    return user_id

def create_new_y_user(table, key_name, key, k, item_name, verbose=False):
    response = table.put_item(Item={key_name: key,
    item_name: json.dumps(np.random.rand(k).tolist(), separators=(',', ':'), sort_keys=True, indent=4)})
    if verbose:
        print(response)
    return response

def update_table_vector(table, key_name, key_value, vector_update):
    '''Function to update the corresponding vector of as row of id:key_value in a table'''
    try:
        response = table.update_item(Key={key_name: key_value},
        UpdateExpression='SET vector = :vector_update',
        ExpressionAttributeValues={':vector_update': json.dumps(vector_update.tolist(), separators=(',', ':'), sort_keys=True, indent=4)})
    except ClientError as e:
        print(e.response['Error']['Message'])
    else:
        return response

def get_item_name_object(table, key_name, key, item_name):
    """Get the list item in a table corresponding to the key,
    and return it as a json vector. Manage potential errors
    which could occur getting the element.
    """
    try:
        response = table.get_item(Key={key_name: str(key)})
    except ClientError as e:
        print(e.response['Error']['Message'])
    else:
        return response['Item'][item_name]

def transform_json_vector_to_matrix(json_vector, data_axis):
    """Transform a vector saved in a list form in a json object
    to a double dimension np.ndarray (a matrix)"""
    vector = np.array(json.loads(json_vector))
    try:
        assert data_axis==0 or data_axis==1
    except:
        print("Calling function with wrong axis attribute")
    else:
        if data_axis == 0:
            vector = vector[:,np.newaxis]
        elif data_axis == 1:
            vector = vector[np.newaxis,:]
        return vector

def get_y_model_vector(table, key_name, key, item_name, data_axis):
    """Return the user_id row of the X matrix latent factor
    X is the local-user part of the model.
    """
    x_u_json_vector = get_item_name_object(table, key_name, key, item_name)
    try:
        return transform_json_vector_to_matrix(x_u_json_vector, data_axis)
    except:
        print("Error in the x_u type got in the X model table")

def update_y_model_vector(table, key_name, key_value, vector_update):
    """Function to update a row of the Y matrix in the database"""
    return update_table_vector(table, key_name, key_value, vector_update)

def get_mapped(table,  key_name, key, field_name):
    try:
        response = table.get_item(Key={key_name: key})
    except ClientError as e:
        print(e.response['Error']['Message'])
    else:
        return response['Item'][field_name]



def handler(event, context):
    print('Event: ', event)  #  api_gateway_endpoint?user_id=2
    try:
        user_id = get_user_id(event, 'rawQueryString', verbose=VERBOSE)
    except:
        return {'statusCode': '400',' body': 'Wrong data types'}

    response = table_model_y.get_item(Key={'user_id': user_id})
    print(response)
    ### User creation
    if 'Item' not in response:
        try:
            response = create_new_y_user(table_model_y, 'user_id', user_id, K_VAL, 'vector', verbose=VERBOSE)
            assert str(response['ResponseMetadata']['HTTPStatusCode']) == '200'
        except:
            return {'statusCode': '500',
            'body': 'Error adding the user to the model Y database'}

    #### Get item matrix_y from the table (the Y matrix)
    y_matrix = []
    max_mapped = int(get_mapped(mapping_table, 'user_id', 'max', 'mapped'))
    y_matrix = np.zeros((max_mapped+1, K_VAL)) # .T at the end of the for loop
    try:
        response = table_model_y.scan()
        print(response)
        items = response['Items']
        print(items)
        for i, item in enumerate(items):
            user_temp_id = item['user_id']
            mapped_id = int(get_mapped(mapping_table, 'user_id', user_temp_id, 'mapped'))
            vector =  np.array(json.loads(item['vector']))
            y_matrix[mapped_id,:] = vector
        y_matrix = np.array(y_matrix).T
        N_USERS = max_mapped+1   # In the worst case, if R updated (new user) and Y is not updated yet, a row in Y will be full of zeros
        assert y_matrix.shape == (K_VAL, N_USERS)
    except:
        return {'statusCode': '400', 'body': 'Wrong Y matrix shape'}

    ### Interaction with the AWS lambda of the x-part of the model (users)
    # Define the input parameters that will be passed on to the model x function
    input_x = json.dumps({'user_id' : user_id,
               'y_matrix': y_matrix.tolist(),
               'K_VAL': K_VAL,
               'N_USERS': N_USERS}
               , separators=(',', ':'), sort_keys=True, indent=4)

    response = client_lambda.invoke(FunctionName = ARN_LAMBDA_X, InvocationType = 'RequestResponse', Payload = input_x)
    print('Response : ', response)

    try:
        assert str(response['ResponseMetadata']['HTTPStatusCode'])=='200'
    except:
        return {'statusCode': '400', 'body': 'Error returned by the Lambda X'}
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
        gradient_y = np.array(x_json_2['gradient_y'])
        assert user_id_x == user_id and inference_x.shape == (1,N_USERS) and gradient_y.shape == (N_USERS, K_VAL)
    except:
        return {'statusCode': '400', 'body': 'Wrong inference format'}

    ### Aggregation of the client's gradient
    ### Fonction d'aggrégation
    
    gradient_y_vector = gradient_y
    ### Stochastic Gradient descent:
    Y = y_matrix.T # (N_USERS, K_VAL)
    m, v = 0.0, 0.0
    for i in range(N_ITER_ADAM):
        m = BETA_1*m + (1-BETA_1)*gradient_y_vector
        v = BETA_2*v + (1-BETA_2)*gradient_y_vector**2
        m_hat = m/(1-BETA_1)
        v_hat = v/(1-BETA_2)
        Y = - GAMMA*m_hat/(np.sqrt(v_hat)+EPSILON)
    
    y_matrix_updated = Y.T #(K_VAL, N_USERS)

    return {'statusCode': response['ResponseMetadata']['HTTPStatusCode'],
            'body': json.dumps(inference_x.tolist())}


###### TEST: api_gateway_endpoint?user_id=2
###### Connexion between 2 LAMBDAS : Need to json.dumps() the dictonnary you're sending, but no need to json.loads to get it in the other lambda