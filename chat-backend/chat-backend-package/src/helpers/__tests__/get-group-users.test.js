// ===== ==== ====
// IMPORTS
const { getGroupUsers } = require('../get-group-users')
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
test('it fetches group users', async () => {
  ddbMock.on(QueryCommand).resolves({
    Items: [
      { id: 'id-1' },
      { id: 'id-2' }
    ]
  })

  const users = await getGroupUsers({ groupId: 'group-id' })

  expect(ddbMock).toHaveReceivedCommandTimes(QueryCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    IndexName: process.env.USERS_GROUP_ID_INDEX_NAME,
    KeyConditionExpression: '#groupId = :groupId',
    ExpressionAttributeNames: {
      '#groupId': 'groupId'
    },
    ExpressionAttributeValues: {
      ':groupId': 'group-id'
    },
    Limit: parseInt(process.env.GROUP_SIZE, 10)
  })
  expect(JSON.stringify(users)).toBe(JSON.stringify([{ id: 'id-1' }, { id: 'id-2' }]))
})
