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

  const user = await dynamoDBDocumentClient.send(new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id }
  })).then((response) => (response.Item))

  if (typeof user !== 'object' || typeof user.id !== 'string') {
    return {}
  }
  return user
}
