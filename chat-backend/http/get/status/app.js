// ===== ==== ====
// IMPORTS
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get user status
 *
 * @param {Object} event
 */
exports.handler = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims
  const { id, groupId } = await getUser({ id: jwt.id })

  let group = null
  let users = null
  if (typeof groupId === 'string') {
    try {
      ({ group, users } = await getGroup({ groupId }))

      if (!group.isPublic) {
        group = { isPublic: false }
        users = null
      } else {
        users = users.map((user) => ({
          id: user.id,
          isConnected: typeof user.connectionId === 'string'
        }))
      }
    } catch (error) {
      console.log(error)
      if (error.message === `group (${groupId}) is not defined`) {
        await dynamoDBDocumentClient.send(new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: { id },
          ConditionExpression: '#groupId = :groupId',
          UpdateExpression: 'REMOVE #groupId',
          ExpressionAttributeNames: { '#groupId': 'groupId' },
          ExpressionAttributeValues: { ':groupId': groupId }
        }))
        group = null
        users = null
      } else {
        throw error
      }
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, group, users })
  }
}
