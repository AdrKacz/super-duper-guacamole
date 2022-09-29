// ===== ==== ====
// IMPORTS
const { getGroupUsers } = require('../src/get-group-users')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  GetCommand,
  BatchGetCommand
} = require('@aws-sdk/lib-dynamodb')

const { SNSClient } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()
  snsMock.reset()

  ddbMock.resolves({})
  snsMock.resolves({})

  // reset console
  log.mockReset()
})

test('it has environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.GROUPS_TABLE_NAME).toBeDefined()
})

test.each([
  { details: 'groupId undefined' },
  { details: 'groupId not a string', groupId: 123, expectedError: 'groupId must be a string' },
  { details: 'fetchedUsers not a array', groupId: 'group', fetchedUsers: { a: 1 }, expectedError: 'fetchedUsers must be an array' },
  { details: 'forbiddenUserIds not a set', groupId: 'group', forbiddenUserIds: { a: 1 }, expectedError: 'forbiddenUserIds must be a set' }
])('.it throws an error if $details', async ({ groupId, fetchedUsers, forbiddenUserIds, expectedError }) => {
  await expect(getGroupUsers({
    groupId,
    fetchedUsers,
    forbiddenUserIds
  })).rejects.toThrow(expectedError)
})

test.each([
  { details: 'all users are already fetched', groupUsers: ['user-a', 'user-b'], fetchedUsers: [{ id: 'user-a' }, { id: 'user-b' }], expected: [{ id: 'user-a' }, { id: 'user-b' }] },
  { details: 'all users are forbidden', groupUsers: ['user-a', 'user-b'], forbiddenUserIds: ['user-a', 'user-b'], expected: [] },
  { details: 'all not forbideen user are already fetched', groupUsers: ['user-a', 'user-b'], fetchedUsers: [{ id: 'user-a' }], forbiddenUserIds: ['user-b'], expected: [{ id: 'user-a' }] }
])(".it doesn't fetch if not needed ($details)", async ({ groupUsers, fetchedUsers, forbiddenUserIds, expected }) => {
  ddbMock.on(GetCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group' },
    ProjectionExpression: '#id, #users',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users'
    }
  }).resolves({
    Item: {
      id: 'group',
      users: new Set(groupUsers)
    }
  })

  ddbMock.on(BatchGetCommand).resolves({
    Responses: {
      [process.env.USERS_TABLE_NAME]: []
    }
  })

  const response = await getGroupUsers({
    groupId: 'group',
    fetchedUsers,
    forbiddenUserIds: new Set([forbiddenUserIds])
  })

  expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 0)
  expect(response).toEqual(expected)
})
