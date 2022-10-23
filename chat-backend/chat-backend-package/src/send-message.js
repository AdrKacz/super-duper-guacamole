// ===== ==== ====
// IMPORTS
const { PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')

const { apiGatewayManagementApiClient } = require('./.clients/aws-clients')
const { saveMessage } = require('./.helpers/save-message')

// ===== ==== ====
// EXPORTS
/**
 * Get user from its connectionId
 *
 * @param {Object} user
 * @param {string} user.id
 * @param {string?} user.connectionId
 * @param {Object} message
 * @param {string} message.action
 */
exports.sendMessage = async ({ id, connectionId }, message) => {
  if (typeof id !== 'string') {
    throw new Error('user.id must be a string')
  }

  if (typeof message !== 'object' || typeof message.action !== 'string') {
    throw new Error('message.action must be a string')
  }

  if (typeof connectionId !== 'string') {
    console.log(`user (${id}) has no connectionId`)
    saveMessage({ id }, message)
    return
  }

  const postToConnectionCommand = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify(message)
  })

  console.log(`send message to (${id}, ${connectionId})`)
  await apiGatewayManagementApiClient
    .send(postToConnectionCommand)
    .catch(async (err) => {
      console.log(`error sending message to (${id}, ${connectionId})`, err)
      await saveMessage({ id }, message)
    })
}
