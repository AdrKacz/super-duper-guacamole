// ===== ==== ====
// IMPORTS
const { v4: uuidv4 } = require('uuid') // skipcq: JS-0260

const { UpdateCommand, PutCommand } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME
} = process.env

// ===== ==== ====
// EXPORTS
exports.createGroup = async ({ currentUser, bubble }) => {
  const groupId = uuidv4()
  const group = {
    id: groupId,
    isPublic: false,
    bubble
  }

  if (Array.isArray(currentUser.bannedUser) && currentUser.bannedUser.length > 0) {
    group.blockedUsers = new Set(currentUser.bannedUser)
  }

  await Promise.all([
    // create groupe
    dynamoDBDocumentClient.send(new PutCommand({
      TableName: GROUPS_TABLE_NAME,
      Item: group,
      ConditionExpression: 'attribute_not_exists(id)'
    })),
    // add user to group
    dynamoDBDocumentClient.send(new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: currentUser.id },
      UpdateExpression: 'SET #groupId :groupId',
      ExpressionAttributeNames: { '#groupId': 'groupId' },
      ExpressionAttributeValues: { ':groupId': groupId }
    }))
  ]).then((results) => (console.log(results)))
    .catch((error) => (console.error(error)))
}
