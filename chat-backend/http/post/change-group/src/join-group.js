// ===== ==== ====
// IMPORTS
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { CONSTANTS } = require('chat-backend-package') // skipcq: JS-0260
const { sendMessages } = require('chat-backend-package/src/send-messages') // skipcq: JS-0260
const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  GROUP_SIZE: GROUP_SIZE_STRING
} = process.env
const GROUP_SIZE = parseInt(GROUP_SIZE_STRING, 10)

// ===== ==== ====
// EXPORTS
exports.joinGroup = async ({ currentUser, group, users }) => {
  if (group.isPublic) {
    throw new Error('you can only join a private group')
  } else if (!group.isPublic && users.length + 1 >= GROUP_SIZE) {
    console.log('join private group and set it to public', group)
    // group big enough to turn public
    await Promise.all([
      // add user to group
      setGroupId({ id: currentUser.id, groupId: group.id }),
      // update group size and turn group public and update banned users
      updateGroup({ groupId: group.id, isPublic: CONSTANTS.TRUE, blockedUserIds: currentUser.blockedUserIds }),
      // warn new users
      warnNewUsers({ users: users.concat([currentUser]) })
    ]).then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  } else {
    console.log('join private group and keep it private', group)
    await Promise.all([
      // add user to group
      setGroupId({ id: currentUser.id, groupId: group.id }),
      // increase group size and update banned users
      updateGroup({ groupId: group.id, blockedUserIds: currentUser.blockedUserIds })
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
 * Update group isPublic, and bannedUserIds
 *
 * @param {string} groupId
 * @param {string} isPublic
 * @param {Set} blockedUserIds
 *
 * @return {Promise}
 */
const updateGroup = ({ groupId, isPublic, blockedUserIds }) => {
  let updateExpression = ''
  const expressionAttributeNames = {}
  const expressionAttributeValues = {}
  if (isPublic === CONSTANTS.TRUE) {
    updateExpression = `${updateExpression}
SET #isPublic = :isPublic`
    expressionAttributeNames['#isPublic'] = 'isPublic'
    expressionAttributeValues[':isPublic'] = CONSTANTS.TRUE
  }

  if (blockedUserIds.size > 0) {
    updateExpression = `${updateExpression}
ADD #bannedUserIds :blockedUserIds`
    expressionAttributeNames['#bannedUserIds'] = 'bannedUserIds'
    expressionAttributeValues[':blockedUserIds'] = new Set(blockedUserIds)
  }

  if (updateExpression.length > 0) {
    return dynamoDBDocumentClient.send(new UpdateCommand({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: groupId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }))
  } else {
    // nothing to update
    return Promise.resolve()
  }
}

/**
 * Warn new users they joined a group
 *
 * @param {object[]} users
 *
 * @return {Promise}
 */
const warnNewUsers = ({ users }) => (Promise.all([
  sendMessages({ users, message: { action: 'update-status' }, useSaveMessage: false }),
  sendNotifications({
    users,
    notification: {
      title: 'Viens te présenter 🥳',
      body: 'Je viens de te trouver un groupe !'
    }
  })
]))
