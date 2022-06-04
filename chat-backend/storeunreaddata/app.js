// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Store unread data to user database
// event.Records[0].Sns.Message
// users : List<Object>
//      id : String - user id
//      connectionId : String? - user connection id
// message: Map<String,String>
//      action : String - action performed

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
  console.log(`
  Receives:
  \tRecords[0].Sns.Message:
  ${event.Records[0].Sns.Message}
  `)

  const body = JSON.parse(event.Records[0].Sns.Message)

  const users = body.users
  const message = body.message

  if (users === undefined || message === undefined) {
    throw new Error('users and message must be defined')
  }

  if (users.length === 0) {
    throw new Error('users.length cannot be 0')
  }

  // store message
  const updateStoreDataCommands = users.map((user) => new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: user.id },
    UpdateExpression: `
        SET #unreadData = list_append(if_not_exists(#unreadData, :emptyList), :message)
        REMOVE #connectionId
        `,
    ExpressionAttributeNames: {
      '#unreadData': 'unreadData',
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':message': [message],
      ':emptyList': []
    }
  }))

  const promises = updateStoreDataCommands.map((updateStoreDataCommand) => (
    dynamoDBDocumentClient.send(updateStoreDataCommand)
  ))

  await Promise.allSettled(promises)
}
