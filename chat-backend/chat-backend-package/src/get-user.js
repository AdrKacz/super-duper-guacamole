// ===== ==== ====
// IMPORTS
const { GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('./clients/aws/dynamo-db-client')

const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get user from its id
 *
 * @param {string} id
 *
 * @return {Promise<User>}
 */
exports.getUser = async ({ id }) => {
  if (typeof id !== 'string') {
    throw new Error('id must be a string')
  }

  const getCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id, #groupId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#groupId': 'groupId'
    }
  })
  const user = await dynamoDBDocumentClient.send(getCommand).then((response) => (response.Item))

  if (typeof user === 'undefined' || typeof user.id === 'undefined') {
    return {}
  }
  return { id: user.id, groupId: user.groupId }
}
