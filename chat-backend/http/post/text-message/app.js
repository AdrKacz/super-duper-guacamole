// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const {
  getGroup,
  getUser,
  sendMessages,
  sendNotifications
} = require('file:../../../chat-backend-package')

/**
 * Send text message to group users
 *
 * @param {Object} event
 * @param {string} event.message
 */
exports.handler = async (event) => {
  if (typeof event.message !== 'string') {
    return { statusCode: 400 }
  }
  const testId = '1234' // TODO: use real id provided by Auth
  const { id, groupId } = await getUser({ id: testId })
  const { group, users } = await getGroup({ groupId })

  await Promise.all([
    sendMessages({ users, message: event.message, useSaveMessage: true }),
    sendNotifications({
      users,
      notification: {
        title: 'Les gens parlent 🎉',
        body: 'Tu es trop loin pour entendre ...'
      }
    })
  ])

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, group, users })
  }
}
