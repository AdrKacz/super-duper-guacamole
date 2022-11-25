// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260

const { USERS_TABLE_NAME } = process.env

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

  await Promise.allSettled([
    dynamoDBDocumentClient.send(updateBannedUserCommandCloseVote),
    sendNotifications({
      users: otherUsers.concat([user]),
      notification: {
        title: 'Le vote est terminé 🗳',
        body: 'Viens voir le résultat !'
      }
    })
  ])
}
