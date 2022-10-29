// ===== ==== ====
// IMPORTS
const { messaging } = require('./clients/firebase-clients')

// ===== ==== ====
// EXPORTS
/**
 * Send notification to a users via Firebase
 *
 * @param {Object[]} users
 * @param {string?} users[].firebaseToken
 * @param {Object} notification
 * @param {string} notification.title
 * @param {string} notification.body
 *
 * @return {id: string, groupId: string}
 */
exports.sendNotifications = async ({ users, notification: { title, body } }) => {
  if (!Array.isArray(users)) {
    throw new Error('users must be an array')
  }

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
