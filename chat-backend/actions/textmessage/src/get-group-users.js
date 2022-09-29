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
  console.log('getGroupUsers', groupId, fetchedUsers, forbiddenUserIds)
  // validate arguments
  if (typeof groupId !== 'string') {
    throw new Error('groupId must be a string')
  }

  if (typeof fetchedUsers !== 'undefined' && !Array.isArray(fetchedUsers)) {
    throw new Error('fetchedUsers must be an array')
  }

  if (typeof forbiddenUserIds !== 'undefined' && !(forbiddenUserIds instanceof Set)) {
    throw new Error('forbiddenUserIds must be a set')
  }
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
  for (const fetchedUserId of (fetchedUsers ?? [])) {
    fetchedUserIds.add(fetchedUserId.id)
  }

  const groupUserIds = []
  for (const groupUserId of group.users) {
    const isUserForbidden = forbiddenUserIds ?? new Set().has(groupUserId)
    const isUserFetched = fetchedUserIds.has(groupUserId)
    if (!isUserForbidden && !isUserFetched) {
      groupUserIds.push({ id: groupUserId })
    }
  }

  console.log('DEBUG getGroupUsers', fetchedUserIds, groupUserIds)

  if (groupUserIds.length === 0) {
    // no new user to fetch
    return fetchedUsers ?? []
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

  console.log('getGroupUsers - return', users.concat(fetchedUsers ?? []))
  return users.concat(fetchedUsers ?? [])
}
