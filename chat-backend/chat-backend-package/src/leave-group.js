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
  console.log('leave group', currentUser)

  // remove user from group
  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: currentUser.id },
    ConditionExpression: '#groupId = :groupId',
    UpdateExpression: 'REMOVE #groupId, #banVotingUsers, #banConfirmedUsers, #confirmationRequired',
    ExpressionAttributeNames: {
      '#groupId': 'groupId',
      '#banVotingUsers': 'banVotingUsers',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#confirmationRequired': 'confirmationRequired'
    },
    ExpressionAttributeValues: { ':groupId': currentUser.groupId }
  }))

  let group = null
  let users = null
  try {
    ({ group, users } = await getGroup({ groupId: currentUser.groupId }))
  } catch (error) {
    if (error.message === `group (${currentUser.groupId}) is not defined`) {
      console.log('group is not defined')
      return
    }
    throw error
  }

  if (!group.isPublic) {
    throw new Error('you cannot change group yet')
  }

  const usersWithoutCurrentUser = users.filter(({ id }) => (currentUser.id !== id))

  if (usersWithoutCurrentUser.length <= 1) {
    // leave and delete group
    // delete group
    await Promise.all([
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
    ]).then((results) => (console.log('leave and delete group', group, results)))
      .catch((error) => (console.error('leave and delete group', group, error)))
  } else {
    // leave group
    // update group
    await Promise.all([
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
    ]).then((results) => (console.log('leave group', group, results)))
      .catch((error) => (console.error('leave group', group, error)))
  }
}
