// ===== ==== ====
// IMPORTS
const { getUser } = require('../get-user')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  GetCommand
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
test('it throws error when id is not a string', async () => {
  await expect(getUser({ id: 1 })).rejects.toThrow('id must be a string')
})
test.each([
  { details: 'it returns user', item: { id: 'id', groupId: 'group-id' }, expected: { id: 'id', groupId: 'group-id' } },
  { details: 'it returns an empty object if no user found', expected: {} },
  { details: 'it returns an empty object if user has no id', item: { groupId: 'group-id' }, expected: {} }
])('.test $details', async ({ item, expected }) => {
  ddbMock.on(GetCommand).resolves({
    Item: item
  })

  const response = await getUser({ id: 'id' })

  expect(ddbMock).toHaveReceivedCommandWith(GetCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' }
  })
  expect(response).toEqual(expected)
})
