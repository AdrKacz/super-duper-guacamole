// ===== ==== ====
// IMPORTS
const { getUserAndBannedUser } = require('../src/get-user-and-banned-user')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  BatchGetCommand
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
test.each([
  { details: 'user first', users: [{ id: 'id' }, { id: 'banned-user-id' }] },
  { details: 'banned user first', users: [{ id: 'banned-user-id' }, { id: 'id' }] }
])('it returns user, banned user, and group ($details)', async ({ users }) => {
  ddbMock.on(BatchGetCommand).resolves({
    Responses: {
      [process.env.USERS_TABLE_NAME]: users
    }
  })

  const response = await getUserAndBannedUser({ id: 'id', bannedUserId: 'banned-user-id' })

  expect(response).toEqual({
    user: { id: 'id' },
    bannedUser: { id: 'banned-user-id' }
  })

  expect(ddbMock).toHaveReceivedCommandWith(BatchGetCommand, {
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
      }
    }
  })
})
