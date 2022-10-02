// ===== ==== ====
// IMPORTS
const { BatchGetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('../aws-clients')

const {
  USERS_TABLE_NAME
} = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get group of users
 *
 * @param {Set<string>} userIds - ids to fetch
 * @param {Set<string>?} forbiddenUserIds - don't retrieve these users
 *
 * @return {Promise<{id: string, connectionId: string, firebaseToken: string}[]>}
 */
exports.getUsers = async ({ userIds, forbiddenUserIds = new Set() }) => {
  const userIdsToGet = []
  for (const userIdToGet of userIds) {
    if (!forbiddenUserIds.has(userIdToGet)) {
      userIdsToGet.push({ id: userIdToGet })
    }
  }

  if (userIdsToGet.length === 0) {
    // do not fetch if nothing to fetch
    return []
  }

  const batchOtherUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        // user and banned user already requested
        Keys: userIdsToGet,
        ProjectionExpression: '#id, #connectionId, #firebaseToken',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId',
          '#firebaseToken': 'firebaseToken'
        }
      }
    }
  })
  const users = await dynamoDBDocumentClient.send(batchOtherUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

  return users
}
