// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { BatchGetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get all parties of the event (user, banned user, and group)
 *
 * @param {string} id - user id
 * @param {string} bannedUserId - banned user id
 * @param {string} groupId - group id
 *
 * @return {Promise<{user: Object, bannedUser: Object, group: Object}>}
 */
exports.getUserAndBannedUser = async ({ id, bannedUserId }) => {
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: [{ id }, { id: bannedUserId }],
        ProjectionExpression: '#id, #groupId, #group, #connectionId, #firebaseToken, #banVotingUsers, #confirmationRequired',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#groupId': 'groupId',
          '#group': 'group', // for backward compatibility
          '#connectionId': 'connectionId',
          '#firebaseToken': 'firebaseToken',
          '#banVotingUsers': 'banVotingUsers',
          '#confirmationRequired': 'confirmationRequired'
        }
      }
    }
  })

  const users = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))
  // NOTE: will raise an error if less than two results in users

  let [user, bannedUser] = users
  if (user.id !== id) {
    user = users[1]
    bannedUser = users[0]
  }
  console.log('user:', user)
  console.log('bannedUser:', bannedUser)

  return { user, bannedUser }
}
