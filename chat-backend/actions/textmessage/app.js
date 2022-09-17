// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Switch group
// event.body
// message : String

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, BatchGetCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN,
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

  // get id and groupId
  const { id, groupId } = await connectionIdToUserIdAndGroupId(event.requestContext.connectionId)

  if (typeof id === 'undefined' || typeof groupId === 'undefined') {
    return
  }

  const body = JSON.parse(event.body)

  const message = body.message
  if (typeof message === 'undefined') {
    throw new Error('message must be defined')
  }

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

  if (!group.users.has(id)) {
    throw new Error(`user <${id}> is not in group <${groupId}>`)
  }

  // retreive users
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: Array.from(group.users).map((userId) => ({ id: userId })),
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  const users = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

  const user = users.find((u) => (u.id === id))
  if (user === undefined || user.connectionId !== event.requestContext.connectionId) {
    throw new Error(`user <${id}> has connectionId <${user?.connectionId}> but sent request via connectionId <${event.requestContext.connectionId}>`)
  }

  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users,
      message: {
        action: 'textmessage',
        message
      }
    })
  })

  const publishSendNotificationCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      topic: `group-${groupId}`,
      notification: {
        title: 'Les gens parlent 🎉',
        body: 'Tu es trop loin pour entendre ...'
      }
    })
  })

  await Promise.allSettled([
    snsClient.send(publishSendMessageCommand),
    snsClient.send(publishSendNotificationCommand)
  ])

  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
async function connectionIdToUserIdAndGroupId (connectionId) {
  // Get id and groupId associated with connectionId
  // connectionId - String
  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  })
  const user = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    console.log('Query Response:', response)
    if (response.Count > 0) {
      return response.Items[0]
    }
    return {}
  })

  if (typeof user.id === 'undefined') {
    return {}
  }
  return { id: user.id, groupId: user.groupId ?? user.group } // .group for backward compatibility
}
