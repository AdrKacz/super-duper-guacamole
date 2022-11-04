// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { v4: uuidv4 } = require('uuid') // skipcq: JS-0260

const { QueryCommand } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { UpdateCommand, DeleteCommand, PutCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260
const {
  getGroup,
  getUser,
  sendMessages,
  sendNotifications
} = require('chat-backend-package') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  GROUPS_BUBBLE_INDEX_NAME
} = process.env

// ===== ==== ====
// EXPORTS
/**
   * Leave group if any and join new group
   *
   * @param {Object} event
   */
exports.handler = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims

  const currentUser = await getUser({ id: jwt.id })
  if (typeof currentUser.groupId === 'string') {
    const { group, users } = await getGroup({ groupId: currentUser.groupId })

    if (!group.isPublic) {
      return {
        statusCode: '400',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'you cannot change group yet' })
      }
    }

    const usersWithoutCurrentUser = users.filter(({ id }) => (currentUser.id !== id))
    if (group.groupSize - 1 <= 1) {
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
        sendMessages({ usersWithoutCurrentUser, message: { action: 'status-update' }, useSaveMessage: false }),
        sendNotifications({
          usersWithoutCurrentUser,
          notification: {
            title: 'Ton groupe est vide 😔',
            body: 'Reconnecte toi pour demander un nouveau groupe ...'
          }
        })
      ]).then((results) => (console.log(results)))
        .catch((error) => (console.error(error)))
    } else {
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
        new UpdateCommand({
          TableName: GROUPS_TABLE_NAME,
          Key: { id: currentUser.groupId },
          ReturnValues: 'UPDATED_NEW',
          UpdateExpression: 'ADD #groupSize :minusOne',
          ExpressionAttributeNames: { '#groupSize': 'groupSize' },
          ExpressionAttributeValues: { ':minusOne': -1 }
        }),
        // warn remaining users
        sendMessages({ usersWithoutCurrentUser, message: { action: 'status-update' }, useSaveMessage: false }),
        sendNotifications({
          usersWithoutCurrentUser,
          notification: {
            title: 'Le groupe rétrécit 😔',
            body: 'Quelqu\'un a quitté le groupe ...'
          }
        })
      ]).then((results) => (console.log(results)))
        .catch((error) => (console.error(error)))
    }
  }

  const bubble = '' // TODO: create bubble from answers
  const { group, users } = await findGroup({ groupId: currentUser.id, bubble })

  if (typeof group === 'object') {
    if (group.isPublic) {
      await Promise.all([
        // add user to group
        dynamoDBDocumentClient.send(new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: { id: currentUser.id },
          UpdateExpression: 'SET #groupId :groupId',
          ExpressionAttributeNames: { '#groupId': 'groupId' },
          ExpressionAttributeValues: { ':groupId': group.id }
        })),
        // update group size
        dynamoDBDocumentClient.send(new UpdateCommand({
          TableName: GROUPS_TABLE_NAME,
          Key: { id: group.id },
          UpdateExpression: 'ADD #groupSize :plusOne',
          ExpressionAttributeNames: { '#groupSize': 'groupSize' },
          ExpressionAttributeValues: { ':plusOne': +1 }
        })),
        // warn new user
        sendMessages({ users: [currentUser], message: { action: 'status-update' }, useSaveMessage: false }),
        sendNotifications({
          users,
          notification: {
            title: 'Viens te présenter 🥳',
            body: 'Je viens de te trouver un groupe !'
          }
        }),
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
    } else if (!group.isPublic && group.groupSize + 1 >= 3) {
      await Promise.all([
        // add user to group
        dynamoDBDocumentClient.send(new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: { id: currentUser.id },
          UpdateExpression: 'SET #groupId :groupId',
          ExpressionAttributeNames: { '#groupId': 'groupId' },
          ExpressionAttributeValues: { ':groupId': group.id }
        })),
        // update group size and turn group public
        dynamoDBDocumentClient.send(new UpdateCommand({
          TableName: GROUPS_TABLE_NAME,
          Key: { id: group.id },
          UpdateExpression: `
SET #isPublic :true
ADD #groupSize :plusOne`,
          ExpressionAttributeNames: {
            '#isPublic': 'isPublic',
            '#groupSize': 'groupSize'
          },
          ExpressionAttributeValues: {
            ':true': true,
            ':plusOne': +1
          }
        })),
        // warn users
        sendMessages({ users: users.concat([currentUser]), message: { action: 'status-update' }, useSaveMessage: false }),
        sendNotifications({
          users,
          notification: {
            title: 'Viens te présenter 🥳',
            body: 'Je viens de te trouver un groupe !'
          }
        })
      ]).then((results) => (console.log(results)))
        .catch((error) => (console.error(error)))
    }
  } else {
    // create group
    const newGroupId = uuidv4()
    await Promise.all([
    // create groupe
      dynamoDBDocumentClient.send(new PutCommand({
        TableName: GROUPS_TABLE_NAME,
        Item: {
          id: newGroupId,
          isPublic: false,
          bubble
          // TODO: add block users to banned users
        },
        ConditionExpression: 'attribute_not_exists(id)'
      })),
      // add user to group
      dynamoDBDocumentClient.send(new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: currentUser.id },
        UpdateExpression: 'SET #groupId :groupId',
        ExpressionAttributeNames: { '#groupId': 'groupId' },
        ExpressionAttributeValues: { ':groupId': newGroupId }
      }))
    ]).then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentUser.id })
  }
}

// ===== ==== ====
// HELPERS
async function findGroup ({ oldGroupId, bubble, blockedUsers }) {
  // look for existing group
  const { Count: queryCount, Items: queryItems } = await dynamoDBDocumentClient.send(new QueryCommand({
    TableName: GROUPS_TABLE_NAME,
    IndexName: GROUPS_BUBBLE_INDEX_NAME,
    Limit: 10,
    KeyConditionExpression: '#bubble = :bubble AND groupSize < :five',
    ProjectionExpression: '#id',
    FilterExpression: '#id <> :groupId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#bubble': 'bubble',
      '#groupSize': 'groupSize'
    },
    ExpressionAttributeValues: {
      ':bubble': bubble,
      ':five': 5,
      ':oldGroupId': oldGroupId
    }
  }))

  if (queryCount > 0) {
    // shuffle results
    queryItems.sort(() => 0.5 - Math.random())

    // return first valid group
    for (const { id: groupId } of queryItems) {
      const { group, users } = getGroup({ groupId })
      if (isGroupValid({ group, users, blockedUsers })) {
        return { group, users }
      }
    }
  }

  return {}
}

function isGroupValid ({ group, userId, users, blockedUsers }) {
  // verify if user is not banned from group
  if (typeof group.bannedUsers === 'object' && group.bannedUsers.has(userId)) {
    return false
  }

  // verify if user has not blocked user from group
  if (typeof blockedUsers === 'object') {
    for (const { id } of users) {
      if (blockedUsers.has(id)) {
        return false
      }
    }
  }

  return true
}
