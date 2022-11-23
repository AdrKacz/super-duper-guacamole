// ===== ==== ====
// IMPORTS
const { UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

const { snsClient } = require('../aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN
} = process.env

// ===== ==== ====
// EXPORTS
exports.leaveGroup = async ({ currentUser }) => {
  if (typeof currentUser.groupId !== 'string') {
    return
  }
  const { group, users } = await getGroup({ groupId: currentUser.groupId })

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
        Key: { id: currentUser.groupId },
        ConditionExpression: '#groupSize <= :one',
        ExpressionAttributeNames: { '#groupSize': 'groupSize' },
        ExpressionAttributeValues: { ':one': 1 }
      })),
      // warn remaining users
      snsClient.send(new PublishCommand({
        TopicArn: SEND_MESSAGE_TOPIC_ARN,
        Message: JSON.stringify({
          users,
          message: {
            action: 'update-status'
          }
        })
      })),
      snsClient.send(new PublishCommand({
        TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
        Message: JSON.stringify({
          users: usersWithoutCurrentUser,
          notification: {
            title: 'Ton groupe est vide 😔',
            body: 'Reconnecte toi pour demander un nouveau groupe ...'
          }
        })
      }))
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
      snsClient.send(new PublishCommand({
        TopicArn: SEND_MESSAGE_TOPIC_ARN,
        Message: JSON.stringify({
          users: usersWithoutCurrentUser,
          message: {
            action: 'update-status'
          }
        })
      })),
      snsClient.send(new PublishCommand({
        TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
        Message: JSON.stringify({
          users: usersWithoutCurrentUser,
          notification: {
            title: 'Le groupe rétrécit 😔',
            body: 'Quelqu\'un a quitté le groupe ...'
          }
        })
      }))
    ]).then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  }
}
