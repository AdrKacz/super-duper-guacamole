// ===== ==== ====
// IMPORTS
const { GetCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('../aws-clients')

const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME
} = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get group of users
 *
 * @param {string} groupId
 * @param {Object[]?} fetchedUsers - list of users already fetched
 * @param {Set<string>?} forbiddenUserIds - don't send message to these users
 *
 * @return {Promise<{id: string, connectionId: string}[]>} - list of users just fetched concatenated with users already fetched
 */
exports.getGroupUsers = async ({ groupId, fetchedUsers, forbiddenUserIds }) => {
  console.log('getGroupUsers with', groupId, fetchedUsers, forbiddenUserIds)
  // set optional variables
  const definedFetchedUsers = fetchedUsers ?? []
  const definedForbiddenUserIds = forbiddenUserIds ?? new Set()

  // get group user ids
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupId },
    ProjectionExpression: '#id, #users',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users'
    }
  })
  const group = await dynamoDBDocumentClient.send(getGroupCommand).then((response) => (response.Item))

  if (typeof group === 'undefined') {
    throw new Error(`group (${groupId}) is not defined`)
  }

  // define set of users to fetch
  const fetchedUserIds = new Set([])
  for (const fetchedUserId of (definedFetchedUsers)) {
    fetchedUserIds.add(fetchedUserId.id)
  }

  const groupUserIds = []
  for (const groupUserId of group.users) {
    const isUserForbidden = (definedForbiddenUserIds).has(groupUserId)
    const isUserFetched = fetchedUserIds.has(groupUserId)
    if (!(isUserForbidden || isUserFetched)) {
      groupUserIds.push({ id: groupUserId })
    }
  }

  if (groupUserIds.length === 0) {
    // no new user to fetch
    return definedFetchedUsers
  }

  // get users
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: groupUserIds,
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  const users = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

  console.log('getGroupUsers returns', users.concat(definedFetchedUsers))
  return users.concat(definedFetchedUsers)
}
