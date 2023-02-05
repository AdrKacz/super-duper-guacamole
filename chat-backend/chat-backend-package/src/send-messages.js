// ===== ==== ====
// IMPORTS
const { sendMessage } = require('./helpers/send-message')

// ===== ==== ====
// EXPORTS
/**
 * Send message to a users via WebSocket
 *
 * @param {Object[]} users
 * @param {string} users[].id
 * @param {string?} users[].connectionId
 * @param {Object} message
 * @param {string} message.action
 * @param {string?} [useSaveMessage=true] - save message if cannot send it
 *
 * @return {id: string, groupId: string}
 */
exports.sendMessages = async ({ users, message, useSaveMessage = true }) => {
  if (!Array.isArray(users)) {
    throw new Error('users must be an array')
  }

  if (typeof message !== 'object' || typeof message.action !== 'string') {
    throw new Error('message.action must be a string')
  }

  await Promise.allSettled(users.map((user) => (
    sendMessage({ user, message, useSaveMessage })
  ))).then((results) => (console.log('send messages', results)))
}
