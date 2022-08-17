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

/**
 * Share profile to other group users
 *
 * @param {Object} event
 * @param {string} user.requestContext.connectionId
 * @param {Object} user.body
 */
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const user = await connectionIdToUserIdAndGroupId(event.requestContext.connectionId)
  user.connectionId = event.requestContext.connectionId

  if (typeof user.id === 'undefined') {
    return
  }

  // retreive group
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
  console.log(`group: ${group}`)
  if (group === undefined) {
    console.log('group not defined')
    throw new Error(`group <${user.group}> is not defined`)
  }

  if (!group.users.has(user.id)) {
    console.log('user not in group')
    throw new Error(`user <${user.id}> is not in group <${group.id}>`)
  }

  // retreive users
  console.log(`query users: ${Array.from(group.users).filter(id => id !== user.id).map((id) => ({ id }))}`)
  const batchGetOtherUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: Array.from(group.users).filter(id => id !== user.id).map((id) => ({ id })),
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  const otherUsers = await dynamoDBDocumentClient.send(batchGetOtherUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))
  console.log(`otherUsers: ${otherUsers}`)
  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: otherUsers.concat([user]),
      message: {
        action: 'shareprofile',
        user: user.id
      }
    })
  })

  const publishSendNotificationCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      topic: `group-${group.id}`,
      notification: {
        title: 'Les masques tombent 🎭',
        body: "Quelqu'un vient de révéler son identité"
      }
    })
  })

  await Promise.allSettled([
    snsClient.send(publishSendMessageCommand),
    snsClient.send(publishSendNotificationCommand)
  ]).then((results) => console.log(results))

  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
/**
 * Get user id and group id from connection id
 *
 * @param {string} connectionId
 */
async function connectionIdToUserIdAndGroupId (connectionId) {
  // Get userId and GroupId associated with connectionId
  // connetionId - String
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
  return { id: user.id, group: user.group }
}
