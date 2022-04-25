// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Register connectionId
// event.body
// id : String - userid

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const body = JSON.parse(event.body)

  const id = body.id
  if (id === undefined) {
    throw new Error('id must be defined')
  }

  // update user and retrieve old unreadData (if any)
  const updateCommand = new UpdateCommand({
    ReturnValues: 'UPDATED_OLD',
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    UpdateExpression: `
    SET #connectionId = :connectionId
    REMOVE #unreadData
    `,
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId',
      '#unreadData': 'unreadData'
    },
    ExpressionAttributeValues: {
      ':connectionId': event.requestContext.connectionId
    }
  })
  const user = await dynamoDBDocumentClient.send(updateCommand).then((response) => (response.Attributes))

  const unreadData = []
  if (user !== undefined && user.unreadData !== undefined) {
    unreadData.push(...user.unreadData)
  }

  // send message
  // NOTE: could be done in parallel of DDB updates
  const publishCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, connectionId: event.requestContext.connectionId }],
      message: {
        action: 'register',
        unreadData: unreadData
      }
    })
  })

  await snsClient.send(publishCommand)

  return {
    statusCode: 200
  }
}
