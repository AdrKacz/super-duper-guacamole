from http.client import ResponseNotReady
import boto3
import numpy as np
import json
import os
from urllib import parse
from ast import literal_eval
from botocore.exceptions import ClientError

# Get the service resource.
client_dynamodb = boto3.resource('dynamodb')
# Access the desired table resource
table_implicit_feedbacks_R = client_dynamodb.Table('awa-implicit-feedback-R')
mapping_table = client_dynamodb.Table('awa-mapping-table')
# Define the client to interact with AWS Lambda
client_lambda = boto3.client('lambda')

# Environment variables
N_USERS = int(os.environ.get('N_USERS'))
ARN_LAMBDA_USERS_MARKS_R = os.environ.get('ARN_LAMBDA_R')
assert N_USERS != None and ARN_LAMBDA_USERS_MARKS_R != None

def create_new_user(table, key_name, key, field_name, vector_value):
    """"Create new user row within the R table, with all marks sets to 0."""
    table.put_item(Item={key_name: key,
    field_name: json.dumps(vector_value.tolist(), separators=(',', ':'), sort_keys=True, indent=4)})

def create_new_user_mapping(table, key_name, key, field_name, mapping_value):
    """"Create new user row with the corresponding mapped index in the R matrix"""
    table.put_item(Item={key_name: key,
    field_name: mapping_value})

def update_table_vector(table, key_name, key_value, vector_update):
    '''Function to update the corresponding vector of as row of id:key_value in a table'''
    table.update_item(Key={key_name: key_value},
    UpdateExpression='SET vector = :vector_update',
    ExpressionAttributeValues={':vector_update': json.dumps(vector_update.tolist(), separators=(',', ':'), sort_keys=True, indent=4)})

def post_R_user(table, user_id, prev_conv_id, prev_conv_users, prev_conv_nb_messages):
    """Compute and post a mark for a set of (user_id, user_i_previous_conv_id).
    This mark is saved in the user_id row of the R matrix.
    The R matrix is the matrix containing all the implicit feedback
    in the form of a mark.
    """
    ###### USE update_table_vector
    return ##### TO COMPLETE

def get_mapped(table,  key_name, key, field_name):
    try:
        response = table.get_item(Key={key_name: key})
    except ClientError as e:
        print(e.response['Error']['Message'])
    else:
        return response['Item'][field_name]

def handler(event, context):
    print('Event: ', event) #  api_gateway_endpoint?user_id=2&ids_nb_messages=(3,12),(4,32)
    try:
        # Variables
        print(event['rawQueryString'])
        url_parsed = parse.parse_qs(event['rawQueryString'])  # {'user_id':['2'],'ids_nb_messages': ['(3,12),(4,32)']}
        print(url_parsed)  
        user_id = ''.join(url_parsed['user_id'])
        str_ids_nb_messages = url_parsed['ids_nb_messages'][0]
        tuple_ids_nb_messages = literal_eval(str_ids_nb_messages)
        list_ids_nb_messages =  [(x[0], x[-1]) for x in tuple_ids_nb_messages]
        assert isinstance(int(user_id),int) and isinstance(list_ids_nb_messages, list)
    except:
        return {'statusCode': '400',
            'body': 'Wrong data input type for R update'}
    # Check if it is a new user:
    response = table_implicit_feedbacks_R.get_item(Key={'user_id': user_id})
    print(response)
   
    if 'Item' not in response:
        # Row initialisation & User creation
        max_mapped = int(get_mapped(mapping_table, 'user_id', 'max', 'mapped'))
        create_new_user_mapping(mapping_table, 'user_id', user_id, 'mapped', max_mapped+1)
        mapping_table.update_item(Key={'user_id': 'max'}, UpdateExpression='SET mapped = :max_update', ExpressionAttributeValues={':max_update': max_mapped+1})
        create_new_user(table_implicit_feedbacks_R, 'user_id', user_id, 'R_u', np.zeros(N_USERS))
    
    ### R_u update:
    ####### TO COMPLETE ########

    return {'statusCode': '200',
            'body': 'Update succeeded'}

##### TEST: api_gateway_endpoint?user_id=2&ids_nb_messages=(3,12),(4,32)
# {'user_id':['2'],'ids_nb_messages': ['(3,12),(4,32)']}