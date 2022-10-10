// ===== ==== ====
// IMPORTS
const { BatchGetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('../aws-clients')

const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME
} = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get all parties of the event (banned user, and group)
 *
 * @param {string} bannedId - banned user id
 * @param {string} groupId - group id
 *
 * @return {Promise<{, bannedUser: Object, group: Object}>}
 */
exports.getBannedUserAndGroup = async (bannedId, groupId) => {
  console.log(`Will fetch user (${bannedId}) and group (${groupId})`)
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
      },
      [GROUPS_TABLE_NAME]: {
        Keys: [{ id: groupId }],
        ProjectionExpression: '#users',
        ExpressionAttributeNames: {
          '#users': 'users'
        }
      }
    }
  })

  const [[bannedUser], [group]] = await dynamoDBDocumentClient.send(batchGetBannedUserAndGroupCommand).then((response) => {
    console.log('getBannedUserAndGroup - response:')
    console.log(response)
    return [response.Responses[USERS_TABLE_NAME], response.Responses[GROUPS_TABLE_NAME]]
  })
  // NOTE: will raise an error if less than one result in users

  console.log('bannedUser:', bannedUser)
  console.log('bannedUser.banConfirmedUsers:', bannedUser.banConfirmedUsers)
  console.log('group:', group)

  return { bannedUser, group }
}
