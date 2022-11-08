// ===== ==== ====
// IMPORTS
const { QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('../clients/aws/dynamo-db-client')

const {
  USERS_TABLE_NAME,
  USERS_GROUP_ID_INDEX_NAME,
  MAXIMUM_GROUP_SIZE
} = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get users in a group
 *
 * @param {string} groupId
 *
 * @return {Promise<User[]>}
 */
exports.getGroupUsers = async ({ groupId }) => {
  console.log(`get group users in group (${groupId})`)

  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_GROUP_ID_INDEX_NAME,
    KeyConditionExpression: '#groupId = :groupId',
    ExpressionAttributeNames: {
      '#groupId': 'groupId'
    },
    ExpressionAttributeValues: {
      ':groupId': groupId
    },
    Limit: MAXIMUM_GROUP_SIZE
  })

  const users = await dynamoDBDocumentClient.send(queryCommand).then((response) => (response.Items))
  console.log('users', users)
  return users
}
