// ===== ==== ====
// IMPORTS
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('../clients/aws-clients')

// ===== ==== ====
// CONSTANTS
const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get user from its connectionId
 *
 * @param {Object} user
 * @param {string} user.id
 * @param {Object} message
 * @param {string} message.action
 */
exports.saveMessage = async ({ id }, message) => {
  if (typeof id !== 'string') {
    throw new Error('user.id must be a string')
  }

  if (typeof message !== 'object' || typeof message.action !== 'string') {
    throw new Error('message.action must be a string')
  }

  const updateCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
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
  })

  await dynamoDBDocumentClient.send(updateCommand)
}
