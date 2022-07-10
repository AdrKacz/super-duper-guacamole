// ===== ==== ====
// IMPORTS
const { GetCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN
} = process.env

// ===== ==== ====
// EXPORTS
exports.getOtherGroupUsers = async (userId, groupId) => {
  if (typeof groupId === 'undefined') {
    throw new Error(`groupId <${groupId}> is undefined`)
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
  if (typeof group === 'undefined') {
    throw new Error(`group <${groupId}> isn't found`)
  }

  // retreive users
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: Array.from(group.users).filter((id) => (id !== userId)).map((id) => ({ id })),
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  return dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))
}

exports.informGroup = (userId, otherUsers) => {
  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: otherUsers,
      message: {
        action: 'login',
        id: userId
      }
    })
  })
  return snsClient.send(publishSendMessageCommand)
}
