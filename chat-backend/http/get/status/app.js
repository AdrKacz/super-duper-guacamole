// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { getGroup, getUser } = require('chat-backend-package') // skipcq: JS-0260

// ===== ==== ====
// EXPORTS
/**
 * Get user status
 *
 * @param {Object} event
 */
exports.handler = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims
  const { id, groupId } = await getUser({ id: jwt.id })

  let group = null
  let users = null
  if (typeof groupId === 'string') {
    ({ group, users } = await getGroup({ groupId }))
    if (!group.isPublic) {
      group = { isPublic: false }
      users = null
    } else {
      users = users.map((user) => ({
        id: user.id,
        isConnected: typeof user.connectionId === 'string'
      }))
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, group, users })
  }
}
