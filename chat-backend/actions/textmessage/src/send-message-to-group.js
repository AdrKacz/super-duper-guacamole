// ===== ==== ====
// IMPORTS
const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { snsClient } = require('../aws-clients')

const { getGroupUsers } = require('./get-group-users')

const {
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN
} = process.env

// ===== ==== ====
// EXPORTS
/**
 * Send message to a group of users
 *
 * @param {string} groupId
 * @param {Object} message - message to send
 * @param {Object?} notification - notification to send if any
 * @param {Object[]?} fetchedUsers - list of users already fetched
 * @param {Set<string>?} forbiddenUserIds - don't send message to these users
 */
exports.sendMessageToGroup = async ({ groupId, message, notification, fetchedUsers, forbiddenUserIds }) => {
  console.log('sendMessageToGroup', groupId, message, notification, fetchedUsers, forbiddenUserIds)
  const users = await getGroupUsers({
    groupId,
    fetchedUsers,
    forbiddenUserIds
  })

  console.log('sendMessageToGroup - create publish commands')
  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users,
      message
    })
  })

  const publishSendNotificationCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      topic: `group-${groupId}`,
      notification
    })
  })

  console.log('sendMessageToGroup - return')
  return Promise.allSettled([
    snsClient.send(publishSendMessageCommand),
    snsClient.send(publishSendNotificationCommand)
  ])
}
