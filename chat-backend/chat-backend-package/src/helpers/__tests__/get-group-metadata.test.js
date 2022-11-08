// ===== ==== ====
// IMPORTS
const { getGroupMetadata } = require('../get-group-metadata')
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
test('it throws on undefined returned group', async () => {
  await expect(getGroupMetadata({ groupId: 'group-id' })).rejects.toThrow('group (group-id) is not defined')
})

test.each([
  { details: 'public', isPublic: true, expected: true },
  { details: 'private', isPublic: false, expected: false },
  { details: 'public status not defined', expected: true }
])('it gets group ($details)', async ({ isPublic, expected }) => {
  ddbMock.on(GetCommand).resolves({
    Item: { id: 'group-id', isPublic }
  })
  const group = await getGroupMetadata({ groupId: 'group-id' })

  expect(ddbMock).toHaveReceivedCommandTimes(GetCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(GetCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group-id' }
  })

  expect(JSON.stringify(group)).toBe(JSON.stringify({ id: 'group-id', isPublic: expected }))
})
