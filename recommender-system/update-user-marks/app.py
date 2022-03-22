import json
import boto3
import numpy as np
import os
from urllib import parse
from ast import literal_eval
from botocore.exceptions import ClientError
from decimal import Decimal

# Get the service resource.
client_dynamodb = boto3.resource('dynamodb')
# Access the desired table resource
table_implicit_feedbacks_R = client_dynamodb.Table('awa-implicit-feedback-R')
mapping_table = client_dynamodb.Table('awa-mapping-table')
demapping_table = client_dynamodb.Table('awa-demapping-table')
# Define the client to interact with AWS Lambda
client_lambda = boto3.client('lambda')

# Environment variables
N_USERS_MAX = int(os.environ.get('N_USERS'))
ARN_LAMBDA_USERS_MARKS_R = os.environ.get('ARN_LAMBDA_R')
TIME_REFRESH_CONSTANT = Decimal(os.environ.get('TIME_REFRESH_CONSTANT'))
assert N_USERS_MAX is not None and ARN_LAMBDA_USERS_MARKS_R is not None

def create_new_user(table, key_name, key, field_name, vector_value, field_name_2, value_2):
    """"Create new user row within the R table, with all marks sets to 0."""
    table.put_item(Item={key_name: key,
    field_name: json.dumps(vector_value.tolist(), separators=(',', ':'), sort_keys=True, indent=4),
    field_name_2: value_2})

def put_item_table(table, key_name, key, item_name, item, verbose=False):
    response = table.put_item(Item={key_name: key, item_name: item})
    if verbose:
        print(response)
    return response

def update_table(table, key_name, key_value, item_name, update_item):
    '''Function to update the corresponding vector of as row of id:key_value in a table'''
    try:
        response = table.update_item(Key={key_name: key_value},
        UpdateExpression='SET {} = :update_item'.format(item_name),
        ExpressionAttributeValues={':update_item': update_item})
    except ClientError as e:
        print(e.response['Error']['Message'])
    else:
        return response

def update_table_vector(table, key_name, key_value, item_name, update_item):
    response = update_table(table, key_name, key_value, item_name, 
        json.dumps(update_item.tolist(), separators=(',', ':'), sort_keys=True, indent=4))
    return response

def post_R_user(table, user_id, prev_conv_id, prev_conv_users, prev_conv_nb_messages):
    """Compute and post a mark for a set of (user_id, user_i_previous_conv_id).
    This mark is saved in the user_id row of the R matrix.
    The R matrix is the matrix containing all the implicit feedback
    in the form of a mark.
    """
    ###### USE update_table_vector
    return ##### TO COMPLETE

def get_method(table,  key_name, key, field_name):
    try:
        response = table.get_item(Key={key_name: key})
    except ClientError as e:
        print(e.response['Error']['Message'])
    else:
        return response['Item'][field_name]

def get_r_u_vector(table, key_name, key, item_name):
    """Return the user_id row of the X matrix latent factor
    X is the local-user part of the model.
    """
    x_u_json_vector = get_method(table, key_name, key, item_name)
    try:
        return np.array(json.loads(x_u_json_vector))
    except:
        print("Error in the r_u type got in the X model table")

def get_mapped(table,  key_name, key, field_name):
    return get_method(table,  key_name, key, field_name)

def handler(event, context):
    print('Event: ', event) #  api_gateway_endpoint?user_id=2_36&ids_nb_messages=(abcd,12)_(bcde,32)
    try:
        # Variables
        print(event['rawQueryString'])
        url_parsed = parse.parse_qs(event['rawQueryString'])
        print(url_parsed)
        user_id_nb_messages_raw = url_parsed['user_id'][0].split('_')
        user_id_raw, nb_messages = user_id_nb_messages_raw[0], int(user_id_nb_messages_raw[1])
        str_ids_nb_messages = url_parsed['ids_nb_messages'][0]
        clean_list_raw_id_nb_message = list(map(lambda x: x.replace('(','').replace(')','').split(','),str_ids_nb_messages.split('_')))
        print(clean_list_raw_id_nb_message)
        clean_dict_id_nb_message = dict(map(lambda x: (int(get_mapped(mapping_table, 'user_id_raw', x[0], 'user_id')), int(x[1])), clean_list_raw_id_nb_message))
        print(clean_dict_id_nb_message)
    except:
        return {'statusCode': '400',
            'body': 'Wrong data input type for R update'}

    # Mapped id
    try:
        user_id = str(get_mapped(mapping_table, 'user_id_raw', user_id_raw, 'user_id'))
    except:
        return {'statusCode': '400', 'body': 'Wrong input user_id, error getting the mapped id'}

    # R table (notation table) - Check if it is a new user
    response = table_implicit_feedbacks_R.get_item(Key={'user_id': user_id})
    if 'Item' not in response:
        # User creation - Initialisation of the notation
        create_new_user(table_implicit_feedbacks_R, 'user_id', user_id, 'R_u', np.zeros(N_USERS_MAX), 'exponential_avg', None)
    ### R_u update:
    else:
        exponential_avg = get_method(table_implicit_feedbacks_R,  'user_id', user_id, 'exponential_avg')
        print('type exponential_avg', exponential_avg, type(exponential_avg))
        print('type TIME_REFRESH_CONSTANT', TIME_REFRESH_CONSTANT, type(TIME_REFRESH_CONSTANT))
        if exponential_avg is not None:
            exponential_avg = (nb_messages - exponential_avg)* TIME_REFRESH_CONSTANT + exponential_avg # TIME_REFRESH_CONSTANT = 2/(Period+1)
            print('Exponential avg update')
        else:
            exponential_avg = nb_messages
            print('Exponential avg setup')
        print('type exponential_avg', type(exponential_avg))
        exponential_avg = Decimal(exponential_avg)
        print('type nb_messages', type(nb_messages))
        mark = Decimal(nb_messages/exponential_avg)
        print('Mark :', mark)
        #### UPDATE
        response = update_table(table_implicit_feedbacks_R, 'user_id', user_id, 'exponential_avg', exponential_avg)
        r_u = get_r_u_vector(table_implicit_feedbacks_R, 'user_id', user_id, 'R_u')

        for user_id_temp in clean_dict_id_nb_message:
            r_u[user_id_temp] = mark
        response = update_table_vector(table_implicit_feedbacks_R, 'user_id', user_id, 'R_u', r_u)
    return {'statusCode': '200',
            'body': 'Update succeeded'}

##### TEST: api_gateway_endpoint?user_id=2_36&ids_nb_messages=(abcd,12)_(bcde,32)