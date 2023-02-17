// ===== ==== ====
// IMPORTS
const { PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi') // skipcq: JS-0260
const { apiGatewayManagementApiClient } = require('../clients/aws/api-gateway-management-client')

const { saveMessage } = require('./save-message')
const { disconnectUser } = require('../disconnect-user')

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
 * @param {string} useSaveMessage - save message if cannot send it
 */
exports.sendMessage = async ({ user: { id, connectionId }, message, useSaveMessage }) => {
  if (typeof id !== 'string') {
    throw new Error('user.id must be a string')
  }

  if (typeof useSaveMessage !== 'boolean') {
    throw new Error('useSaveMessage must be a boolean')
  }

  if (typeof connectionId !== 'string' && useSaveMessage) {
    console.log(`user (${id}) has no connectionId`)
    saveMessage({ user: { id }, message })
    return
  }

  const postToConnectionCommand = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify(message)
  })

  console.log(`send message to (${id}, ${connectionId}): ${message}`)
  await apiGatewayManagementApiClient
    .send(postToConnectionCommand)
    .catch(async (err) => {
      console.log(`error sending message to (${id}, ${connectionId})`, err)
      await Promise.allSettled([
        disconnectUser({ id, connectionId }),
        useSaveMessage ? saveMessage({ user: { id }, message }) : Promise.resolve()
      ])
    })
}
