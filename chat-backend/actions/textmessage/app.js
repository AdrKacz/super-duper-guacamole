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
    return {
      message: 'user or group cannot be found',
      statusCode: 403
    }
  }

  const body = JSON.parse(event.body)

  const message = body.message
  if (typeof message === 'undefined') {
    throw new Error('message must be defined')
  }

  console.log('handler - call sendMessageToGroup', {
    groupId,
    message: {
      action: 'textmessage',
      message
    },
    notification: {
      title: 'Les gens parlent 🎉',
      body: 'Tu es trop loin pour entendre ...'
    },
    fetchedUserIds: new Set([id])
  })

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
    fetchedUserIds: new Set([id])
  })

  console.log('handler - return')
  return {
    statusCode: 200
  }
}
