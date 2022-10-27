// ===== ==== ====
// IMPORTS
const { PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi') // skipcq: JS-0260

const { apiGatewayManagementApiClient } = require('../clients/aws-clients')
const { saveMessage } = require('./save-message')

// ===== ==== ====
// EXPORTS
/**
 * Send message to an user via WebSocket
 *
 * @param {Object} user
 * @param {string} user.id
 * @param {string?} user.connectionId
 * @param {Object} message
 * @param {string} message.action
 */
exports.sendMessage = async ({ user: { id, connectionId }, message }) => {
  if (typeof id !== 'string') {
    throw new Error('user.id must be a string')
  }

  if (typeof connectionId !== 'string') {
    console.log(`user (${id}) has no connectionId`)
    saveMessage({ user: { id }, message })
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
      await saveMessage({ user: { id }, message })
    })
}
