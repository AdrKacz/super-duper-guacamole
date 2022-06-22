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
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, BatchGetCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  // get connectionId group (with global secondary index)
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

  if (user === undefined || user.id === undefined) {
    return
  }
  // update user
  const updateUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: user.id },
    UpdateExpression: `
    SET #lastConnectionHalfDay = :lastConnectionHalfDay
    REMOVE #connectionId
    `,
    ExpressionAttributeNames: {
      '#lastConnectionHalfDay': 'lastConnectionHalfDay',
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':lastConnectionHalfDay': ((ts) => (ts - (ts % 43200000)))(Date.now()) // timestamp rounded to 12pm or 12am
    }
  })
  const updatePromise = dynamoDBDocumentClient.send(updateUserCommand)

  if (user.group === undefined) {
    await updatePromise
    return
  }

  // retreive group (if any)
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.group },
    ProjectionExpression: '#id, #users',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users'
    }
  })
  const group = await dynamoDBDocumentClient.send(getGroupCommand).then((response) => (response.Item))

  if (group === undefined) {
    throw new Error(`group <${user.group}> is not defined`)
  }

  // retreive users
  const otherUserIds = Array.from(group.users).filter((id) => (id !== user.id))
  if (otherUserIds.length === 0) {
    return
  }
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: otherUserIds.map((id) => ({ id })),
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  const users = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users,
      message: {
        action: 'logout',
        id: user.id
      }
    })
  })
  await snsClient.send(publishSendMessageCommand)
  await updatePromise
}
