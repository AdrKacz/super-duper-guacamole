// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const { mockClient } = require('aws-sdk-client-mock')
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const ddbMock = mockClient(DynamoDBDocumentClient)

// ===== ==== ====
// TESTS
test('it rejects without a token', async () => {
  await expect(handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({})
  })).rejects.toThrow('token must be a string')
})

test('it updates firebase token', async () => {
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ token: 'token' })
  })

  expect(JSON.stringify(response)).toBe(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'id' })
  }))
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: 'SET #firebaseToken = :token',
    ExpressionAttributeNames: { '#firebaseToken': 'firebaseToken' },
    ExpressionAttributeValues: { ':token': 'token' }
  })
})
