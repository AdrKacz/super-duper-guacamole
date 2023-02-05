// ===== ==== ====
// IMPORTS
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const response = await deleteUnreadData(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

/**
 * Delete user unread data
 */
const deleteUnreadData = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims

  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: jwt.id },
    UpdateExpression: 'REMOVE #unreadData',
    ExpressionAttributeNames: { '#unreadData': 'unreadData' }
  }))

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: jwt.id })
  }
}
