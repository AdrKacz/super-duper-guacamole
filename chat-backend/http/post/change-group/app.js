// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { getUser } = require('chat-backend-package') // skipcq: JS-0260

const { findGroup } = require('./src/findGroup')
const { leaveGroup } = require('./src/leaveGroup')
const { createGroup } = require('./src/createGroup')
const { joinGroup } = require('./src/joinGroup')

// ===== ==== ====
// EXPORTS
/**
   * Leave group if any and join new group
   *
   * @param {Object} event
   */
exports.handler = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims

  const currentUser = await getUser({ id: jwt.id })
  try {
    await leaveGroup({ currentUser })
  } catch (error) {
    return {
      statusCode: '400',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    }
  }

  const bubble = '' // TODO: create bubble from answers
  const { group, users } = await findGroup({ groupId: currentUser.id, bubble })

  if (typeof group === 'object') {
    await joinGroup({ currentUser, group, users })
  } else {
    // create group
    await createGroup({ currentUser, bubble })
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentUser.id })
  }
}
