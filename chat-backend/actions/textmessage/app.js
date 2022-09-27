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
  const { id, groupId } = await getUserFromConnectionId(event.requestContext.connectionId)

  if (typeof id === 'undefined' || typeof groupId === 'undefined') {
    return {
      message: 'user or group cannot be found',
      statusCode: 403
    }
  }

  const body = JSON.parse(event.body)

  const message = body.message
  if (typeof message === 'undefined') {
    throw new Error('message must be defined')
  }

  console.log('handler - call sendMessageToGroup', {
    groupId,
    message: {
      action: 'textmessage',
      message
    },
    notification: {
      title: 'Les gens parlent 🎉',
      body: 'Tu es trop loin pour entendre ...'
    },
    fetchedUserIds: new Set([id])
  })

  await sendMessageToGroup({
    groupId,
    message: {
      action: 'textmessage',
      message
    },
    notification: {
      title: 'Les gens parlent 🎉',
      body: 'Tu es trop loin pour entendre ...'
    },
    fetchedUserIds: new Set([id])
  })

  console.log('handler - return')
  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
/**
 * Get user from its connectionId
 *
 * @param {string} connectionId
 *
 * @return {id: string, groupId: string}
 */
async function getUserFromConnectionId (connectionId) {
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

/**
 * Get group of users
 *
 * @param {string} groupId
 * @param {Object[]?} fetchedUsers - list of users already fetched
 * @param {Set<string>?} forbiddenUserIds - don't send message to these users
 *
 * @return {Promise<{id: string, connectionId: string}[]>} - list of users just fetched concatenated with users already fetched
 */
async function getGroupUsers ({ groupId, fetchedUsers, forbiddenUserIds }) {
  console.log('getGroupUsers', groupId, fetchedUsers, forbiddenUserIds)
  // get group user ids
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

  if (typeof group === 'undefined') {
    throw new Error(`group (${groupId}) is not defined`)
  }

  // define set of users to fetch
  const fetchedUserIds = new Set([])
  for (const fetchedUserId of (fetchedUsers ?? [])) {
    fetchedUserIds.add(fetchedUserId.id)
  }

  const groupUserIds = []
  for (const groupUserId of group.users) {
    if (!(forbiddenUserIds ?? new Set()).has(groupUserId) || !fetchedUserIds.has(groupUserId)) {
      groupUserIds.push({ id: groupUserId })
    }
  }

  if (groupUserIds.length === 0) {
    throw new Error('cannot send message to no one')
  }

  // get users
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: groupUserIds,
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  const users = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

  console.log('getGroupUsers - return')
  return users.concat(fetchedUsers ?? [])
}

/**
 * Send message to a group of users
 *
 * @param {string} groupId
 * @param {Object} message - message to send
 * @param {Object?} notification - notification to send if any
 * @param {Object[]?} fetchedUsers - list of users already fetched
 * @param {Set<string>?} forbiddenUserIds - don't send message to these users
 */
async function sendMessageToGroup ({ groupId, message, notification, fetchedUsers, forbiddenUserIds }) {
  console.log('sendMessageToGroup', groupId, message, notification, fetchedUsers, forbiddenUserIds)
  const users = await getGroupUsers({
    groupId,
    fetchedUsers,
    forbiddenUserIds
  })

  console.log('sendMessageToGroup - create publish commands')
  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: users,
      message
    })
  })

  const publishSendNotificationCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      topic: `group-${groupId}`,
      notification
    })
  })

  console.log('sendMessageToGroup - return')
  return Promise.allSettled([
    snsClient.send(publishSendMessageCommand),
    snsClient.send(publishSendNotificationCommand)
  ])
}

exports.getUserFromConnectionId = getUserFromConnectionId
exports.getGroupUsers = getGroupUsers
exports.sendMessageToGroup = sendMessageToGroup
