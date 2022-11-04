// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const {
  getGroup,
  getUser,
  sendMessages,
  sendNotifications
} = require('chat-backend-package') // skipcq: JS-0260

// ===== ==== ====
// EXPORTS
/**
 * Send text message to group users
 *
 * @param {Object} event
 * @param {string} event.message
 */
exports.handler = async (event) => {
  const body = JSON.parse(event.body)
  const message = body.message

  if (typeof message !== 'string') {
    return { statusCode: 400 }
  }

  const jwt = event.requestContext.authorizer.jwt.claims

  const { id, groupId } = await getUser({ id: jwt.id })

  if (typeof groupId !== 'string') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'you don\'t have a group' })
    }
  }

  const { group, users } = await getGroup({ groupId })

  await Promise.all([
    sendMessages({ users, message, useSaveMessage: true }),
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
    body: JSON.stringify({ id, group, message })
  }
}
