// ===== ==== ====
// IMPORTS
const { getUser } = require('../get-user')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  QueryCommand
} = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(DynamoDBDocumentClient)

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})

  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test('it throws error when connectionId is not a string', async () => {
  await expect(getUser({ connectionId: 1 })).rejects.toThrow('connectionId must be a string')
})
test.each([
  { details: 'it returns user', items: [{ id: 'id', groupId: 'group-id' }], expected: { id: 'id', groupId: 'group-id' } },
  { details: 'it returns an empty object if no user found', items: [], expected: {} },
  { details: 'it returns an empty object if user has no id', items: [{ groupId: 'group-id' }], expected: {} },
  { details: 'it returns the first associated user', items: [{ id: 'id' }, { id: 'id-2' }], expected: { id: 'id' } }
])('.test $details', async ({ items, expected }) => {
  const connectionId = 'connection-id'

  ddbMock.on(QueryCommand).resolves({
    Count: items.length,
    Items: items
  })

  const response = await getUser({ connectionId })

  expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    IndexName: process.env.USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  })
  expect(response).toEqual(expected)
})