// ===== ==== ====
// IMPORTS
const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { snsClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const { SEND_MESSAGE_TOPIC_ARN } = process.env

// ===== ==== ====
// EXPORTS
exports.getOtherGroupUsers = async (userId, groupId) => {
  if (typeof groupId === 'undefined') {
    throw new Error(`groupId <${groupId}> is undefined`)
  }

  const { group: { isPublic }, users } = await getGroup({ groupId })
  if (isPublic) {
    return users
  }
  return []
}

exports.informGroup = (userId, otherUsers) => {
  if (otherUsers.length === 0) {
    return Promise.resolve()
  }

  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: otherUsers,
      message: {
        action: 'login',
        id: userId
      }
    })
  })
  return snsClient.send(publishSendMessageCommand)
}
