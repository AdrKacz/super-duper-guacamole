// ===== ==== ====
// IMPORTS
const { QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('../clients/aws/dynamo-db-client')

const {
  USERS_TABLE_NAME,
  USERS_GROUP_ID_INDEX_NAME
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
    Limit: 5 // to replace with env variable MAXIMUM_NUMBER_OF_USERS_PER_GROUP
  })

  const users = await dynamoDBDocumentClient.send(queryCommand).then((response) => (response.Items))
  console.log('users', users)
  return users
}
