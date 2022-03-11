import boto3
import numpy as np

def handler(event, context):
    
     # Get the service resource.
    dynamodb = boto3.resource('dynamodb')
    
    # Access the desired table resource
    db_model_y = dynamodb.Table('awa-model-y')
    
    # Get item M_y from the table (our Y matrix)
    response = db_model_y.get_item(Key={'user_id': 'M_y'})
    item = response['Item']
    print(item)
    
    M_y_upd = np.zeros((10,10))
    
    db_model_y.update_item(
        Key={'user_id': 'M_y'},
        UpdateExpression='SET matrix = :matrix_update',
        ExpressionAttributeValues={
            ':matrix_update': str(M_y_upd)
        }
    )
    
    response = db_model_y.get_item(Key={'user_id': 'M_y'})
    item = response['Item']
    print(item)

    message = 'Niqueeeee'

    return { 
        'message' : message
        }
