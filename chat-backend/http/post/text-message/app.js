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
  console.log('Receives:', JSON.stringify(JSON.parse(event), null, 2))
  const response = await postTextMessage(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

const postTextMessage = async (event) => {
  console.log(`Receives:
Body:
${event.body}`)

  const body = JSON.parse(event.body)
  const message = body.message

  if (typeof message !== 'string') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'you didn\'t send a message' })
    }
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

  if (!group.isPublic) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'you don\'t have a group yet' })
    }
  }

  await Promise.all([
    sendMessages({ users, message: { action: 'text-message', message }, useSaveMessage: true }),
    sendNotifications({
      users: users.filter(({ id: userId }) => (userId !== id)),
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
