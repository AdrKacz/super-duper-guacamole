// TRIGGER
// HTTP API

// ===== ==== ====
// IMPORTS
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260
const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { sendMessages } = require('chat-backend-package/src/send-messages') // skipcq: JS-0260
const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260

/**
 * Share profile to other group users
 *
 * @param {Object} event
 * @param {string} event.requestContext.connectionId
 * @param {Object} event.body
 * @param {Object} event.body.profile
 */
exports.handler = async (event) => {
  console.log('===== ===== ===== ===== ===== =====')
  console.log(event)

  const jwt = event.requestContext.authorizer.jwt.claims
  const body = JSON.parse(event.body)
  const profile = body.profile

  if (typeof profile !== 'object') {
    throw new Error('profile must be an object')
  }

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
    sendMessages({
      users,
      message: {
        action: 'share-profile',
        user: id,
        profile
      },
      useSaveMessage: true
    }),
    sendNotifications({
      users,
      notification: {
        title: 'Les masques tombent 🎭',
        body: "Quelqu'un vient de révéler son identité"
      }
    })
  ])

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }
}
