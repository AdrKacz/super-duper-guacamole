// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { BatchGetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get banned user
 *
 * @param {string} bannedId - banned user id
 *
 * @return {Promise<{bannedUser: Object}>}
 */
exports.getBannedUser = async (bannedId) => {
  console.log(`Will fetch user (${bannedId})`)
  const batchGetBannedUserAndGroupCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: [{ id: bannedId }],
        ProjectionExpression: '#id, #groupId, #connectionId, #banConfirmedUsers, #group',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#groupId': 'groupId',
          '#group': 'group', // for backward compatibility
          '#connectionId': 'connectionId',
          '#banConfirmedUsers': 'banConfirmedUsers'
        }
      }
    }
  })

  const [bannedUser] = await dynamoDBDocumentClient.send(batchGetBannedUserAndGroupCommand).then((response) => {
    console.log('getBannedUserAndGroup - response:')
    console.log(response)
    return response.Responses[USERS_TABLE_NAME]
  })
  // NOTE: will raise an error if less than one result in users

  console.log('bannedUser:', bannedUser)
  console.log('bannedUser.banConfirmedUsers:', bannedUser.banConfirmedUsers)

  return { bannedUser }
}
