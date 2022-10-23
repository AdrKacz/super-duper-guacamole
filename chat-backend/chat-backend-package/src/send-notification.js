// ===== ==== ====
// IMPORTS
const { messaging } = require('./clients/firebase-clients')

// ===== ==== ====
// EXPORTS
/**
 * Get user from its connectionId
 *
 * @param {Object[]} users
 * @param {string?} users[].firebaseToken
 * @param {Object} notification
 * @param {string} notification.title
 * @param {string} notification.body
 *
 * @return {id: string, groupId: string}
 */
exports.sendNotification = async (users, { title, body }) => {
  if (typeof title !== 'string' || typeof body !== 'string') {
    throw new Error('notification.title and notification.body must be strings')
  }

  const tokens = []
  for (const { firebaseToken } of users) {
    if (typeof firebaseToken === 'string' && firebaseToken !== '') {
      tokens.push(firebaseToken)
    }
  }
  const message = { notification: { title, body }, tokens }

  console.log('send notification:\n', message)

  await messaging.sendMulticast(message)
}
