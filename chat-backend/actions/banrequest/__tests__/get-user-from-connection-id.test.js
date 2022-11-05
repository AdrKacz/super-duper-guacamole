// ===== ==== ====
// IMPORTS
const { getUserFromConnectionId } = require('../src/get-user-from-connection-id')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  QueryCommand
} = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// CONSTANTS
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
test('it has environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.USERS_CONNECTION_ID_INDEX_NAME).toBeDefined()
})

test.each([
  { details: 'it returns an empty object if no user found', items: [], expected: {} },
  { details: 'it returns an empty object if user has no id', items: [{}], expected: {} },
  { details: 'it returns the first associated user', items: [{ id: 'id' }, { id: 'id-2' }], expected: { id: 'id' } },
  { details: 'it returns user with group attribute if groupId attribute is not defined', items: [{ id: 'id', group: 'group-id' }], expected: { id: 'id', groupId: 'group-id' } },
  { details: 'it returns user with groupId attribute over group attribute', items: [{ id: 'id', groupId: 'group-id', group: 'group-2' }], expected: { id: 'id', groupId: 'group-id' } }
])('.test $details', async ({ items, expected }) => {
  const connectionId = 'connection-id'

  ddbMock.on(QueryCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    IndexName: process.env.USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  }).resolves({
    Count: items.length,
    Items: items
  })

  const response = await getUserFromConnectionId(connectionId)

  expect(response).toEqual(expected)
})
