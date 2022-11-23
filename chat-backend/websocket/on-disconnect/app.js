// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET - $disconnect

// ===== ==== ====
// EVENT
// Call on disconnection, client doesn't provide an event

// ===== ==== ====
// NOTE
// Store the last day of connection
// Disconnect may not be called everytime
// Resulting in false "Connected" state
// How to remediate it?

// ===== ==== ====
// IMPORTS
const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2))

  // get groupId from connectionId
  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': event.requestContext.connectionId
    }
  })
  const user = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    console.log('Query Response:', response)
    if (response.Count > 0) {
      return response.Items[0]
    } else {
      return undefined
    }
  })

  if (typeof user === 'undefined' || typeof user.id === 'undefined') {
    return
  }
  // update user
  const updateUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: user.id },
    UpdateExpression: `
    SET #lastDeconnectionDay = :lastDeconnectionDay
    REMOVE #connectionId
    `,
    ExpressionAttributeNames: {
      '#lastDeconnectionDay': 'lastDeconnectionDay',
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':lastDeconnectionDay': (new Date()).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'long', day: '2-digit' })
    }
  })
  const updatePromise = dynamoDBDocumentClient.send(updateUserCommand)

  const groupId = user.groupId ?? user.group // .group for backward compatibility
  if (typeof groupId === 'undefined') {
    await updatePromise
    return
  }

  const { group: { isPublic }, users } = await getGroup({ groupId })
  if (!isPublic) {
    await updatePromise
    return
  }

  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users,
      message: {
        action: 'disconnect',
        id: user.id
      }
    })
  })
  await snsClient.send(publishSendMessageCommand)
  await updatePromise
}
