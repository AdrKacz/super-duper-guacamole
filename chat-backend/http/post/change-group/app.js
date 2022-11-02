// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { v4: uuidv4 } = require('uuid')

const { QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb')
const { UpdateCommand, DeleteCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const {
  getGroup,
  getUser,
  sendMessages,
  sendNotifications
} = require('chat-backend-package')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  USERS_LOOKING_FOR_GROUP_INDEX_NAME
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

  const { id, groupId } = await getUser({ id: jwt.id })

  if (typeof groupId === 'string') {
    // leave group
    const updateCommand = new UpdateCommand({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: groupId },
      ReturnValues: 'UPDATED_NEW',
      UpdateExpression: 'ADD #groupSize :minusOne',
      ExpressionAttributeNames: { '#groupSize': 'groupSize' },
      ExpressionAttributeValues: { ':minusOne': -1 }
    })

    const { groupSize } = await dynamoDBDocumentClient.send(updateCommand).then((response) => (response.Attributes))

    // NOTE: can be move to DynamoDB Stream Event
    await updateGroup({ id, groupId, groupSize })
  }

  // NOTE: can be done in parallel (for more expensive logic)
  await findGroup({ id })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }
}

// ===== ==== ====
// HELPERS
async function updateGroup ({ id, groupId, groupSize }) {
  const { users } = await getGroup({ groupId })
  if (groupSize <= 1) {
    // delete group
    const deleteCommand = new DeleteCommand({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: groupId },
      ConditionExpression: '#groupSize <= :one',
      ExpressionAttributeNames: { '#groupSize': 'groupSize' },
      ExpressionAttributeValues: { ':one': 1 }
    })

    await Promise.all([
      dynamoDBDocumentClient.send(deleteCommand)
    ].concat(users.map(({ user }) => {
      const updateCommand = new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: user.id },
        ConditionExpression: '#groupId = :groupId',
        UpdateExpression: 'REMOVE #groupId',
        ExpressionAttributeNames: { '#groupId': 'groupId' },
        ExpressionAttributeValues: { ':groupId': groupId }
      })
      return dynamoDBDocumentClient.send(updateCommand)
    })))
      .then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))
  }

  const usersWithoutCurrentUser = users.filter((user) => (id !== user.id))
  await Promise.all([
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

async function findGroup ({ id }) {
// look for existing group
  const scanCommand = new ScanCommand({
    TableName: GROUPS_TABLE_NAME,
    Limit: 10,
    ProjectionExpression: '#id, #groupSize',
    FilterExpression: '#groupSize < :five',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#groupSize': 'groupSize'
    },
    ExpressionAttributeValues: {
      ':five': 5
    }
  })

  const { Count: scanCount, Items: scanItems } = await dynamoDBDocumentClient.send(scanCommand)
  if (scanCount > 0) {
    // add to group
    const group = scanItems[Math.floor(Math.random() * scanCount)]

    await Promise.all([
      dynamoDBDocumentClient.send(new UpdateCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: group.id },
        ReturnValues: 'UPDATED_NEW',
        UpdateExpression: 'ADD #groupSize :plusOne',
        ExpressionAttributeNames: { '#groupSize': 'groupSize' },
        ExpressionAttributeValues: { ':minusOne': +1 }
      })),
      dynamoDBDocumentClient.send(new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id },
        ReturnValues: 'UPDATED_NEW',
        UpdateExpression: 'SET #groupId :groupId',
        ExpressionAttributeNames: { '#groupId': 'groupId' },
        ExpressionAttributeValues: { ':groupId': group.id }
      })).then((results) => (console.log(results)))
        .catch((error) => (console.error(error)))
    ])

    return true
  }

  // look for user waiting for a group
  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_LOOKING_FOR_GROUP_INDEX_NAME,
    Limit: 5,
    KeyConditionExpression: '#isLookingForGroup = :true',
    ExpressionAttributeNames: {
      '#isLookingForGroup': 'isLookingForGroup'
    },
    ExpressionAttributeValues: {
      ':true': 1
    }
  })

  const { Count: queryCount, Items: queryItems } = await dynamoDBDocumentClient.send(queryCommand)
  if (queryCount > 2) {
    // create group
    const groupId = uuidv4()

    await Promise.all([
      dynamoDBDocumentClient.send(new PutCommand({
        TableName: GROUPS_TABLE_NAME,
        Item: { id: groupId, groupSize: queryCount },
        ConditionExpression: 'attribute_not_exists(id)'
      }))
    ].concat(queryItems.map(({ user }) => (dynamoDBDocumentClient.send(new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: user.id },
      UpdateExpression: 'SET #groupId = :groupId',
      ExpressionAttributeNames: { '#groupId': 'groupId' },
      ExpressionAttributeValues: { ':groupId': groupId }
    }))
    ))))
      .then((results) => (console.log(results)))
      .catch((error) => (console.error(error)))

    return true
  }

  // add to looking for group
  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET #isLookingForGroup = :true',
    ExpressionAttributeNames: { '#isLookingForGroup': 'isLookingForGroup' },
    ExpressionAttributeValues: { ':true': 1 }
  }))
}

// TODO: Filter "Look for user" to not query your self
// TODO: Remove isLookingForGroup from user who get a group
// TODO: Set isLookingForGroup default value to true/false on user creation