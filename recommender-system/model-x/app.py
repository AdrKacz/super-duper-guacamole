import boto3
import numpy as np
import json

def handler(event, context):
    
    print("Event x", event)
     # Get the service resource.
    dynamodb = boto3.resource('dynamodb')
    # Access the desired table resource
    db_model_x = dynamodb.Table('awa-model-x-users-simul')

    # Parameters
    k = 100
    user_id = event["user_id"] # str
    model_inference = bool(event["model_inference"])
    user_creation = bool(event["user_creation"])
    # Matrix initialisation
    init_matrix = np.zeros((1,k))

    # Actions
    if user_creation:
        # Create item M_x
        db_model_x.put_item(
                Item={'user_id': str(user_id),
                    'x_u': str(init_matrix)})

    if model_inference:
        response = db_model_x.get_item(Key={'user_id': str(user_id)})
        item = response['Item']
        print(item)
        
        return {'user_id' : item['user_id'],
                'inference_x' :item['x_u']
        }
