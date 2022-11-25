// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('./clients/aws/dynamo-db-client') // skipcq: JS-0260
const { UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { getGroup } = require('./get-group') // skipcq: JS-0260
const { sendMessages } = require('./send-messages') // skipcq: JS-0260
const { sendNotifications } = require('./send-notifications') // skipcq: JS-0260

const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME
} = process.env

// ===== ==== ====
// EXPORTS
exports.leaveGroup = async ({ currentUser }) => {
  if (typeof currentUser.groupId !== 'string') {
    return
  }
  // handle 'group (f8830129-fc8f-4d0e-b43c-ee27ec982234) is not defined'
  let group = null
  let users = null
  try {
    ({ group, users } = await getGroup({ groupId: currentUser.groupId }))
  } catch (error) {
    if (error.message !== `group (${currentUser.groupId}) is not defined`) {
      return
    }
    throw error
  }

  if (!group.isPublic) {
    throw new Error('you cannot change group yet')
  }

  const usersWithoutCurrentUser = users.filter(({ id }) => (currentUser.id !== id))
  if (usersWithoutCurrentUser.length <= 1) {
    console.log('leave and delete group', group)
    // delete group
    await Promise.all([
      // remove user from group
      dynamoDBDocumentClient.send(new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: currentUser.id },
        ConditionExpression: '#groupId = :groupId',
        UpdateExpression: 'REMOVE #groupId',
        ExpressionAttributeNames: { '#groupId': 'groupId' },
        ExpressionAttributeValues: { ':groupId': currentUser.groupId }
      })),
      // delete group
      dynamoDBDocumentClient.send(new DeleteCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: currentUser.groupId }
        // NOTE: what condition expression would be appropriate here?
        // to not delete group if there are still users (are new incoming users)
      })),
      // warn remaining users
      sendMessages({ users: usersWithoutCurrentUser, message: { action: 'update-status' }, useSaveMessage: false }),
      sendNotifications({
        users: usersWithoutCurrentUser,
        notification: {
          title: 'Ton groupe est vide 😔',
          body: 'Reconnecte toi pour demander un nouveau groupe ...'
        }
      })
    ]).then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  } else {
    console.log('leave group', group)
    // update group
    await Promise.all([
      // remove user from group
      dynamoDBDocumentClient.send(new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: currentUser.id },
        ConditionExpression: '#groupId = :groupId',
        UpdateExpression: 'REMOVE #groupId',
        ExpressionAttributeNames: { '#groupId': 'groupId' },
        ExpressionAttributeValues: { ':groupId': currentUser.groupId }
      })),
      // update group
      dynamoDBDocumentClient.send(new UpdateCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: currentUser.groupId },
        ReturnValues: 'UPDATED_NEW',
        UpdateExpression: 'SET #groupSize = :groupSize',
        ExpressionAttributeNames: { '#groupSize': 'groupSize' },
        ExpressionAttributeValues: { ':groupSize': usersWithoutCurrentUser.length }
      })),
      // warn remaining users
      sendMessages({ users: usersWithoutCurrentUser, message: { action: 'update-status' }, useSaveMessage: false }),
      sendNotifications({
        users: usersWithoutCurrentUser,
        notification: {
          title: 'Le groupe rétrécit 😔',
          body: 'Quelqu\'un a quitté le groupe ...'
        }
      })
    ]).then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  }
}
