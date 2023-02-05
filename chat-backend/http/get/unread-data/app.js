// ===== ==== ====
// IMPORTS
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260

// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(JSON.parse(event), null, 2))
  const response = await getUnreadData(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

const getUnreadData = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims
  const { unreadData } = await getUser({ id: jwt.id })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: jwt.id, unreadData: unreadData ?? [] })
  }
}
