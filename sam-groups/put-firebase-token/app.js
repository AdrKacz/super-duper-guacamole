// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// HTTP API

// ===== ==== ====
// EVENT
// Send message
// event.body
// id : String - user id
// token: String - user firebase notification token

// NOTE:
// could take connectionIds as input to not retrieve it twice
// need to be linked with userids in case some are undefined or stales

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

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
  console.log(`Receives:
\tBody:\n${event.body}
`)

  const body = JSON.parse(event.body)

  const id = body.id
  const token = body.token
  if (id === undefined || token === undefined) {
    throw new Error('id and token must be defined')
  }

  const updateCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
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
    statusCode: 200
  }
}
