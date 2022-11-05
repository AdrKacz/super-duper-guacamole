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
  const newGroupId = uuidv4()
  await Promise.all([
    // create groupe
    dynamoDBDocumentClient.send(new PutCommand({
      TableName: GROUPS_TABLE_NAME,
      Item: {
        id: newGroupId,
        isPublic: false,
        bubble,
        blockedUsers: new Set(currentUser.bannedUser)
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
