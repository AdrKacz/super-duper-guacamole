// ===== ==== ====
// IMPORTS
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const {
  sendMessages,
  sendNotifications
} = require('chat-backend-package') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  MINIMUM_GROUP_SIZE: MINIMUM_GROUP_SIZE_STRING
} = process.env
const MINIMUM_GROUP_SIZE = parseInt(MINIMUM_GROUP_SIZE_STRING, 10)

// ===== ==== ====
// EXPORTS
exports.joinGroup = async ({ currentUser, group, users }) => {
  if (group.isPublic) {
    console.log('join public group', group)
    await Promise.all([
      // add user to group
      setGroupId({ id: currentUser.id, groupId: group.id }),
      // increase group size and update banned users
      updateGroup({ groupId: group.id, groupSize: users.length + 1, isPublic: true, blockedUserIds: currentUser.blockedUserIds }),
      // warn new user
      warnNewUsers({ users: [currentUser] }),
      // warn other users
      sendMessages({ users, message: { action: 'status-update' }, useSaveMessage: false }),
      sendNotifications({
        users,
        notification: {
          title: 'Y\'a du nouveaux 🥳',
          body: 'Quelqu\'un arrive dans le groupe !'
        }
      })
    ]).then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  } else if (!group.isPublic && users.length + 1 >= MINIMUM_GROUP_SIZE) {
    console.log('join private to public group', group)
    // group big enough to turn public
    await Promise.all([
      // add user to group
      setGroupId({ id: currentUser.id, groupId: group.id }),
      // update group size and turn group public and update banned users
      updateGroup({ groupId: group.id, groupSize: users.length + 1, isPublic: true, blockedUserIds: currentUser.blockedUserIds }),
      // warn new users
      warnNewUsers({ users: users.concat([currentUser]) })
    ]).then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  } else {
    console.log('join private group', group)
    await Promise.all([
      // add user to group
      setGroupId({ id: currentUser.id, groupId: group.id }),
      // increase group size and update banned users
      updateGroup({ groupId: group.id, groupSize: users.length + 1, isPublic: false, blockedUserIds: currentUser.blockedUserIds })
    ])
  }
}

// ===== ==== ====
// HELPERS
/**
 * Add group id to user
 *
 * @param {string} id
 * @param {string} groupId
 *
 * @return {Promise}
 */
const setGroupId = ({ id, groupId }) => (dynamoDBDocumentClient.send(new UpdateCommand({
  TableName: USERS_TABLE_NAME,
  Key: { id },
  UpdateExpression: 'SET #groupId = :groupId',
  ExpressionAttributeNames: { '#groupId': 'groupId' },
  ExpressionAttributeValues: { ':groupId': groupId }
})))

/**
 * Update group isPublic, groupSize, and bannedUserIds
 *
 * @param {string} groupId
 * @param {boolean} isPublic
 * @param {Set} blockedUserIds
 *
 * @return {Promise}
 */
const updateGroup = ({ groupId, groupSize, isPublic, blockedUserIds }) => {
  if (blockedUserIds.size > 0) {
    return updateGroupWithBlockedUsers({ groupId, groupSize, isPublic, blockedUserIds })
  }

  return updateGroupWithoutBlockedUsers({ groupId, groupSize, isPublic })
}

/**
 * Update group isPublic, groupSize, and bannedUserIds
 *
 * @param {string} groupId
 * @param {boolean} isPublic
 * @param {Set} blockedUserIds
 *
 * @return {Promise}
 */
const updateGroupWithBlockedUsers = ({ groupId, groupSize, isPublic, blockedUserIds }) => (dynamoDBDocumentClient.send(new UpdateCommand({
  TableName: GROUPS_TABLE_NAME,
  Key: { id: groupId },
  UpdateExpression: `
SET #isPublic = :isPublic, #groupSize = :groupSize
ADD #bannedUserIds :blockedUserIds`,
  ExpressionAttributeNames: {
    '#isPublic': 'isPublic',
    '#groupSize': 'groupSize',
    '#bannedUserIds': 'bannedUserIds'
  },
  ExpressionAttributeValues: {
    ':isPublic': isPublic,
    ':groupSize': groupSize,
    ':blockedUserIds': new Set(blockedUserIds)
  }
})))

/**
 * Update group isPublic and groupSize
 *
 * @param {string} groupId
 * @param {boolean} isPublic
 *
 * @return {Promise}
 */
const updateGroupWithoutBlockedUsers = ({ groupId, groupSize, isPublic }) => (dynamoDBDocumentClient.send(new UpdateCommand({
  TableName: GROUPS_TABLE_NAME,
  Key: { id: groupId },
  UpdateExpression: 'SET #isPublic = :isPublic, #groupSize = :groupSize',
  ExpressionAttributeNames: {
    '#isPublic': 'isPublic',
    '#groupSize': 'groupSize'
  },
  ExpressionAttributeValues: {
    ':isPublic': isPublic,
    ':groupSize': groupSize
  }
})))

/**
 * Warn new users they joined a group
 *
 * @param {object[]} users
 *
 * @return {Promise}
 */
const warnNewUsers = ({ users }) => (Promise.all([
  sendMessages({ users, message: { action: 'status-update' }, useSaveMessage: false }),
  sendNotifications({
    users,
    notification: {
      title: 'Viens te présenter 🥳',
      body: 'Je viens de te trouver un groupe !'
    }
  })
]))
