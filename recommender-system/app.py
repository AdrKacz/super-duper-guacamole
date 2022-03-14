import boto3
import numpy as np
import json

def handler(event, context):
    print(event)
    # Get the service resource.
    dynamodb = boto3.resource('dynamodb')

    # Access the desired table resource
    db_model_y = dynamodb.Table('awa-model-y')
    
    # Parameters
    get_y_matrix = False
    update_y_matrix = False
    matrix_y_update = np.zeros((10,10))
    
    # Variables
    user_id = event["user_id"] # 1
    print(user_id)
    
    model_inference = bool(event["model_inference"]) # True
    print(model_inference)
    user_creation = bool(event["user_creation"]) # False
    x_inference_and_gradient_computation = bool(event["x_inference_and_gradient_computation"]) # True

    # Get item M_y from the table (our Y matrix)
    if get_y_matrix:
        response = db_model_y.get_item(Key={'user_id': 'M_y'})
        item = response['Item']
        return(item)
    
    if update_y_matrix:
        db_model_y.update_item(
            Key={'user_id': 'M_y'},
            UpdateExpression='SET matrix = :matrix_update',
            ExpressionAttributeValues={
                ':matrix_update': str(matrix_y_update)
            }
        )
    
    ### Interaction with the AWS lambda of the x-part of the model (users)
    if x_inference_and_gradient_computation:
        # Define the client to interact with AWS Lambda
        client_lambda = boto3.client('lambda')
        # Define the input parameters that will be passed on to the model x function
        inputParams = {"user_id" : user_id,
                       "model_inference": model_inference,
                       "user_creation" : user_creation
                       }
        
        response = client_lambda.invoke(
            FunctionName = 'arn:aws:lambda:eu-west-3:010661011891:function:awa-get-recommender-system-temporary',
            InvocationType = 'RequestResponse',
            Payload = json.dumps(inputParams))

        responseFromChild = json.load(response['Payload'])
        
        user_id_x = responseFromChild["user_id"]
        inference_x = responseFromChild['inference_x']

        return { 
            'user_id_x' : user_id_x,
            'inference_x' : inference_x
            }
        
