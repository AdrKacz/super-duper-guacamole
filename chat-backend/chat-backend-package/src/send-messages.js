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
 *
 * @return {id: string, groupId: string}
 */
exports.sendNotifications = async ({ users, message }) => {
  if (!Array.isArray(users)) {
    throw new Error('users must be an array')
  }

  if (typeof message !== 'object' || typeof message.action !== 'string') {
    throw new Error('message.action must be a string')
  }

  await Promise.allSettled(users.map((user) => (
    sendMessage({ user, message })
  ))).then((results) => (console.log(results)))
}
