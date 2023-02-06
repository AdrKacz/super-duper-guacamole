// ===== ==== ====
// IMPORTS
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260

// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const response = await getUnreadData(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

/**
 * Get user unread data
 */
const getUnreadData = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims
  const { unreadData } = await getUser({ id: jwt.id })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: jwt.id, unreadData: unreadData ?? [] })
  }
}
