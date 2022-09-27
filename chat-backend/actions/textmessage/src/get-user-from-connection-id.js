// ===== ==== ====
// IMPORTS
const { QueryCommand } = require('@aws-sdk/lib-dynamodb')

const { dynamoDBDocumentClient } = require('../aws-clients')

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
 * @return {id: string, groupId: string}
 */
exports.getUserFromConnectionId = async (connectionId) => {
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
  return { id: user.id, groupId: user.groupId ?? user.group } // .group for backward compatibility
}
