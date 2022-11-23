// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// HTTP API

// ===== ==== ====
// EVENT
// Send message
// event.body
// id : String - user id
// signature : List<Int>
// timestamp : int - when the signature was generated
//      -- message is only valid for +/- 3 seconds (3000 milliseconds)
// publicKey: String - PEM format, base64 encoded
// token: String - user firebase notification token

// NOTE:
// could take connectionIds as input to not retrieve it twice
// need to be linked with userids in case some are undefined or stales

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
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log('===== ===== ===== ===== ===== =====')
  console.log(event)

  const jwt = event.requestContext.authorizer.jwt.claims
  const body = JSON.parse(event.body)

  const token = body.token
  if (typeof token !== 'string') {
    throw new Error('token must be a string')
  }

  const updateCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: jwt.id },
    UpdateExpression: 'SET #firebaseToken = :token',
    ExpressionAttributeNames: {
      '#firebaseToken': 'firebaseToken'
    },
    ExpressionAttributeValues: {
      ':token': token
    }
  })

  await dynamoDBDocumentClient.send(updateCommand)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: jwt.id })
  }
}
