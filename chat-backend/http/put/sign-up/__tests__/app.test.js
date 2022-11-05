// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  PutCommand
} = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// IMPORTS
const ddbMock = mockClient(DynamoDBDocumentClient)

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})
})

// ===== ==== ====
// TESTS
test.each([
  { details: 'wrong id type', id: 1, publicKey: 'public-key' },
  { details: 'wrong public key type', id: 'id' }
])('it rejects on $details', async ({ id, publicKey }) => {
  const response = await handler({
    body: JSON.stringify({ id, publicKey })
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'id and publicKey must be defined with correct type' }))
})

test('it creates item', async () => {
  ddbMock.on(PutCommand).resolves()

  const response = await handler({
    body: JSON.stringify({ id: 'id', publicKey: 'public-key' })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(PutCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Item: { id: 'id', publicKey: 'public-key' },
    ConditionExpression: 'attribute_not_exists(id)'
  })

  expect(response.statusCode).toBe(200)
})

test('it communicates error', async () => {
  ddbMock.on(PutCommand).rejects()

  const response = await handler({
    body: JSON.stringify({ id: 'id', publicKey: 'public-key' })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(PutCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Item: { id: 'id', publicKey: 'public-key' },
    ConditionExpression: 'attribute_not_exists(id)'
  })

  expect(response.statusCode).toBe(400)
})
