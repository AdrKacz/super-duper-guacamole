import boto3
import numpy as np

def handler(event, context):
    
     # Get the service resource.
    dynamodb = boto3.resource('dynamodb')
    
    # Access the desired table resource
    db_model_x = dynamodb.Table('awa-model-x-users-simul')

    M_x_user = np.zeros((1,10))

    # Create item M_x
    db_model_x.put_item(
   Item={
        'user_id': 'janedoe',
        'M_x': str(M_x_user),
    }
)
    message = 'Niqueeeeeuuu'

    return { 
        'message' : message
        }
