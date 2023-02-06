// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

// ===== ==== ====
// HANDLER

exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const response = await putFirebaseToken(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

/**
 * Put firebase token in the user table
 * @param event.body.token
 */
const putFirebaseToken = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims
  const body = JSON.parse(event.body)

  const token = body.token
  if (typeof token !== 'string') {
    throw new Error('token must be a string')
  }

  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: jwt.id },
    UpdateExpression: 'SET #firebaseToken = :token',
    ExpressionAttributeNames: { '#firebaseToken': 'firebaseToken' },
    ExpressionAttributeValues: { ':token': token }
  }))

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: jwt.id })
  }
}
