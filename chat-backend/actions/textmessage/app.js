// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Switch group
// event.body
// message : String

// ===== ==== ====
// IMPORTS
const { getUserFromConnectionId } = require('./src/get-user-from-connection-id')
const { sendMessageToGroup } = require('./src/send-message-to-group')

// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  // get id and groupId
  const { id, groupId } = await getUserFromConnectionId(event.requestContext.connectionId)

  if (typeof id === 'undefined' || typeof groupId === 'undefined') {
    throw new Error('user or group cannot be found')
  }

  const body = JSON.parse(event.body)

  const message = body.message
  if (typeof message === 'undefined') {
    throw new Error('message must be defined')
  }

  await sendMessageToGroup({
    groupId,
    message: {
      action: 'textmessage',
      message
    },
    notification: {
      title: 'Les gens parlent 🎉',
      body: 'Tu es trop loin pour entendre ...'
    },
    fetchedUsers: [{ id, groupId, connectionId: event.requestContext.connectionId }]
  })

  console.log('handler - return')
  return {
    statusCode: 200
  }
}
