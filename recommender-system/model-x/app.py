import boto3
import numpy as np
import json

# Get the service resource.
dynamodb = boto3.resource('dynamodb')
# Access the desired table resource
db_model_x = dynamodb.Table('awa-model-x-users-simul')

def create_new_user(db, key_name, key, k, random=True):
    db.put_item(Item={key_name: str(key),
    'x_u': json.dumps(np.random.rand(k).tolist(), separators=(',', ':'), sort_keys=True, indent=4)})

def get_xu_vector(db, user_id):
    response = db.get_item(Key={'user_id': str(user_id)})
    item = response['Item']
    x_u = np.array(json.loads(item['x_u']))
    x_u = x_u[:,np.newaxis]
    return x_u

def handler(event, context):
    print("Event: ", event)
    # Environment variable
    K_VAL = event["K_VAL"]  # Int
    # Variables
    user_id = str(event["user_id"]) # str
    print("Type :", type(user_id), type(K_VAL))
    assert type(user_id) == str and type(K_VAL) == int
    y_matrix = np.array(event["y_matrix"])
    print("Y_matrix :", type(y_matrix), y_matrix.shape)
    assert isinstance(y_matrix, np.ndarray) and y_matrix.shape[0] == K_VAL

    # Check if it is a new user:
    response = db_model_x.get_item(Key={'user_id': str(user_id)})
    print(response)
    ### User creation
    if 'Item' not in response:
        # Matrix initialisation
        create_new_user(db_model_x, 'user_id', user_id, K_VAL)

    x_u = get_xu_vector(db_model_x, user_id) # Vector in a matrix shape (1,k)
    print("x_u :", x_u.shape, x_u)
    assert isinstance(x_u, np.ndarray) and x_u.shape == (K_VAL,1)

    ### Inference
    # 1st step : Check is the matrix computation is possible
    Y = y_matrix
    alpha = 0.5
    # r_ui = np.dot(x_u.T, y_matrix[:,i])
    r_u = np.dot(x_u.T, y_matrix) # (1,K)x(K,N) = # (1,N)
    # c_ui = 1 + alpha*r_ui
    c_u = 1 + alpha * r_u
    # x_u_opt = np.dot(np.linalg.inv(Y @ C_u @ Y.T + lambda_reg*np.identity(K_VAL)), Y @ C_u @ p(u))


    ### Gradient computation

    return json.dumps({'user_id' : user_id,
            'inference_x' : x_u.tolist()},
             separators=(',', ':'), sort_keys=True, indent=4)
