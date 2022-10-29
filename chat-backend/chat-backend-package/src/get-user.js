// ===== ==== ====
// IMPORTS
const { QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('./clients/aws-clients')

const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME
} = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get user from its connectionId
 *
 * @param {string} connectionId
 *
 * @return {Promise<User>}
 */
exports.getUser = async ({ connectionId }) => {
  if (typeof connectionId !== 'string') {
    throw new Error('connectionId must be a string')
  }

  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  })
  const user = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    console.log('Query Response:', response)
    if (response.Count > 0) {
      return response.Items[0]
    }
    return {}
  })

  if (typeof user.id === 'undefined') {
    return {}
  }
  return { id: user.id, groupId: user.groupId }
}
