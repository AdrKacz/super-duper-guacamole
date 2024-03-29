// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260
const { leaveGroup } = require('chat-backend-package/src/leave-group') // skipcq: JS-0260

const { findGroup } = require('./src/find-group')
const { createGroup } = require('./src/create-group')
const { joinGroup } = require('./src/join-group')

// ===== ==== ====
// EXPORTS
/**
   * Leave group if any and join new group
   *
   * @param {Object} event
   */
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const response = await postChangeGroup(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

/**
 * Change the group of an user
 * @param event.body.city
 * @param event.body.blockedUserIds
 */
const postChangeGroup = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims

  const body = JSON.parse(event.body)

  const currentUser = await getUser({ id: jwt.id })
  currentUser.blockedUserIds = new Set(body.blockedUserIds)
  currentUser.city = body.city

  try {
    await leaveGroup({ currentUser })
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: error.message })
    }
  }

  const { group, users } = await findGroup({ currentUser })
  console.log('group', group)
  console.log('users', users)
  console.log('current user', currentUser)
  if (typeof group === 'object') {
    await joinGroup({ currentUser, group, users })
  } else {
    await createGroup({ currentUser })
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: currentUser.id })
  }
}
