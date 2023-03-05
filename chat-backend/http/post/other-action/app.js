// ===== ==== ====
// IMPORTS
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260
const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260

const { startTyping } = require('./src/start-typing')

// ===== ==== ====
// CONSTANTS
const VALID_ACTIONS = new Set([
  'startTyping',
  'stopTyping'
])

// ===== ==== ====
// EXPORTS
/**
 * transfer action between group users
 * @param event.body.action
 */
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const body = JSON.parse(event.body)
  const action = body.action
  const jwt = event.requestContext.authorizer.jwt.claims

  if (typeof action !== 'string' || !VALID_ACTIONS.has(action)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'you didn\'t send a valid action' })
    }
  }

  const { id, groupId } = await getUser({ id: jwt.id })

  if (typeof groupId !== 'string') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'you don\'t have a group' })
    }
  }

  const { group, users } = await getGroup({ groupId })

  if (!group.isPublic) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'you don\'t have a group yet' })
    }
  }

  switch (action) {
    case 'startTyping':
      await startTyping({ id, users })
      break
    default:
      console.log('No method defined yet for this action:', action)
      break
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: jwt.id })
  }
}
