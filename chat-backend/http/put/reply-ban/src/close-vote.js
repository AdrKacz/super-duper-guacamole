// ===== ==== ====
// IMPORTS
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { dynamoDBDocumentClient, snsClient } = require('../aws-clients')

const {
  USERS_TABLE_NAME,
  SEND_NOTIFICATION_TOPIC_ARN
} = process.env

// ===== ==== ====
// EXPORTS
/**
 * Close the current vote to ban bannedUser
 *
 * @param {string} id - user id
 * @param {string} bannedId - banned user id
 * @param {Object[]} otherUsers  - other group users
 */
exports.closeVote = async ({ user, bannedUser, otherUsers }) => {
  // close the vote
  const updateBannedUserCommandCloseVote = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: bannedUser.id },
    UpdateExpression: `
REMOVE #banVotingUsers, #banConfirmedUsers, #confirmationRequired
`,
    ExpressionAttributeNames: {
      '#banVotingUsers': 'banVotingUsers',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#confirmationRequired': 'confirmationRequired'
    }
  })

  const publishSendNotificationCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      users: otherUsers.concat([user]),
      notification: {
        title: 'Le vote est terminé 🗳',
        body: 'Viens voir le résultat !'
      }
    })
  })

  await Promise.allSettled([
    dynamoDBDocumentClient.send(updateBannedUserCommandCloseVote),
    snsClient.send(publishSendNotificationCommand)
  ])
}
