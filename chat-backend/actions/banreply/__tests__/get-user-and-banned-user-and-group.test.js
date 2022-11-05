// ===== ==== ====
// IMPORTS
const { getUserAndBannedUserAndGroup } = require('../src/get-user-and-banned-user-and-group')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  BatchGetCommand
} = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(DynamoDBDocumentClient)

jest.spyOn(console, 'log')

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
  expect(process.env.GROUPS_TABLE_NAME).toBeDefined()
})

test.each([
  { details: 'user first', users: [{ id: 'id' }, { id: 'banned-user-id' }] },
  { details: 'banned user first', users: [{ id: 'banned-user-id' }, { id: 'id' }] }
])('it returns user, banned user, and group ($details)', async ({ users }) => {
  const groupId = 'group-id'
  ddbMock.on(BatchGetCommand, {
    RequestItems: {
      [process.env.USERS_TABLE_NAME]: {
        Keys: [{ id: 'id' }, { id: 'banned-user-id' }],
        ProjectionExpression: '#id, #groupId, #group, #connectionId, #firebaseToken, #banVotingUsers, #confirmationRequired',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#groupId': 'groupId',
          '#group': 'group', // for backward compatibility
          '#connectionId': 'connectionId',
          '#firebaseToken': 'firebaseToken',
          '#banVotingUsers': 'banVotingUsers',
          '#confirmationRequired': 'confirmationRequired'
        }
      },
      [process.env.GROUPS_TABLE_NAME]: {
        Keys: [{ id: groupId }],
        ProjectionExpression: '#users',
        ExpressionAttributeNames: {
          '#users': 'users'
        }
      }
    }
  }).resolves({
    Responses: {
      [process.env.USERS_TABLE_NAME]: users,
      [process.env.GROUPS_TABLE_NAME]: [{ id: groupId }]
    }
  })

  const response = await getUserAndBannedUserAndGroup({ id: 'id', bannedUserId: 'banned-user-id', groupId })

  expect(response).toEqual({
    user: { id: 'id' },
    bannedUser: { id: 'banned-user-id' },
    group: { id: groupId }
  })
})
