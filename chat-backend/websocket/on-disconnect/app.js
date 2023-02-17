
// ===== ==== ====
// IMPORTS
const { disconnectUser } = require('chat-backend-package/src/disconnect-user') // skipcq: JS-0260

// ===== ==== ====
// HANDLER
/**
 * Call on client disconnection
 * May not be called everytime
 * This is why we also call this function
 *  on every error when sending a message
 *  because error are likely related to a stale connectionId
 */
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))

  await disconnectUser({
    id: event.requestContext.authorizer.id,
    connectionId: event.requestContext.connectionId
  })
}
