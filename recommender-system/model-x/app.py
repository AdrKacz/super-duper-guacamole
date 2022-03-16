import boto3
import numpy as np
import json

# Get the service resource.
client_dynamodb = boto3.resource('dynamodb')
# Access the desired table resource
table_model_x = client_dynamodb.Table('awa-model-x-users-simul')

def create_new_user(table, key_name, key, k, random=True):
    table.put_item(Item={key_name: str(key),
    'x_u': json.dumps(np.random.rand(k).tolist(), separators=(',', ':'), sort_keys=True, indent=4)})

def get_xu_vector(table, user_id):
    response = table.get_item(Key={'user_id': str(user_id)})
    item = response['Item']
    x_u = np.array(json.loads(item['x_u']))
    x_u = x_u[:,np.newaxis]
    return x_u

def handler(event, context):
    print("Event: ", event)
    # Variables
    K_VAL = event["K_VAL"]  # Int
    user_id = str(event["user_id"]) # str
    y_matrix = np.array(event["y_matrix"])
    print("Type :", type(user_id), type(K_VAL))
    try:
        assert type(user_id) == str and type(K_VAL) == int 
        assert isinstance(y_matrix, np.ndarray) and y_matrix.shape[0] == K_VAL
    except:
        return {'statusCode': '400',
            'body': "Wrong data type"}

    print("Y_matrix :", type(y_matrix), y_matrix.shape) 

    # Check if it is a new user:
    response = table_model_x.get_item(Key={'user_id': str(user_id)})
    print(response)
    ### User creation
    if 'Item' not in response:
        # Matrix initialisation
        create_new_user(table_model_x, 'user_id', user_id, K_VAL)

    x_u = get_xu_vector(table_model_x, user_id) # Vector in a matrix shape (1,k)
    print("x_u :", x_u.shape)
    try:
        assert x_u.shape == (K_VAL,1)
    except:
        return {'statusCode': '400',
            'body': "Wrong data shape"}

    ### Inference
    # 1st step : Check is the matrix computation is possible
    Y = y_matrix
    alpha = 0.5
    lambda_reg = 0.5
    # r_ui = np.dot(x_u.T, y_matrix[:,i])
    r_u = np.dot(x_u.T, y_matrix) # (1,K)x(K,N) = # (1,N)   # Note supposé être >0, prendre valeur absolue ?
    # p_ui = r_ui != 0.0
    p_u = r_u!=0.0 # (1,N)
    print("Shape Y : ", Y.shape)
    print("Shape r_u : ", r_u.shape)
    print("Shape p_u : ", p_u.shape)
    # c_ui = 1 + alpha*r_ui
    c_u = 1 + alpha * r_u
    print("Shape c_u : ", c_u.shape)
    C_u_diag = np.diag(c_u.tolist())
    print("Shape C_u_diag : ", C_u_diag.shape)
    # x_u_opt = np.dot(np.linalg.inv(Y @ C_u_diag @ Y.T + lambda_reg*np.identity(K_VAL)), Y @ C_u_diag @ p_u)
    # print("Shape x_u_diag : ", x_u_opt.shape)

    ### Gradient computation

    return json.dumps({'user_id' : user_id,
            'inference_x' : x_u.tolist()},
             separators=(',', ':'), sort_keys=True, indent=4)
