// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { getGroup, getUser } = require('file:../../../chat-backend-package')

/**
 * Get user status
 *
 * @param {Object} event
 */
exports.handler = async (_event) => {
  const testId = '1234' // TODO: use real id provided by Auth
  const { id, groupId } = await getUser({ id: testId })
  const { group, users } = await getGroup({ groupId })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, group, users })
  }
}
