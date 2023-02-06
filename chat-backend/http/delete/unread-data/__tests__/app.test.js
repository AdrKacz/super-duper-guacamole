// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const { mockClient } = require('aws-sdk-client-mock')
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')
const ddbMock = mockClient(dynamoDBDocumentClient)

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// TESTS
test('it deletes unread data', async () => {
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } }
  })

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: 'REMOVE #unreadData',
    ExpressionAttributeNames: { '#unreadData': 'unreadData' }
  })

  expect(JSON.stringify(response)).toBe(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id' })
  }))
})
