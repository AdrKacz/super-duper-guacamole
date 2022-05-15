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
const { DynamoDBDocumentClient, BatchGetCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
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
    ReturnValues: 'ALL_OLD',
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    UpdateExpression: `
    SET #isActive = :isActive, #connectionId = :connectionId
    REMOVE #unreadData
    `,
    ExpressionAttributeNames: {
      '#isActive': 'isActive',
      '#connectionId': 'connectionId',
      '#unreadData': 'unreadData'
    },
    ExpressionAttributeValues: {
      ':connectionId': event.requestContext.connectionId,
      ':isActive': true
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

  const promises = [snsClient.send(publishCommand)]

  if (user !== undefined && user.group !== undefined) {
    promises.push(informGroup(id, user.group))
  }

  await Promise.allSettled(promises)

  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS

async function informGroup (userId, groupId) {
  // retreive group
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupId },
    ProjectionExpression: '#id, #users',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users'
    }
  })
  const group = await dynamoDBDocumentClient.send(getGroupCommand).then((response) => (response.Item))

  if (group === undefined) {
    throw new Error(`group <${groupId}> is not defined`)
  }

  // retreive users
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: Array.from(group.users).filter((id) => (id !== userId)).map((id) => ({ id: id })),
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
      users: users,
      message: {
        action: 'login',
        id: userId
      }
    })
  })
  await snsClient.send(publishSendMessageCommand)
}
