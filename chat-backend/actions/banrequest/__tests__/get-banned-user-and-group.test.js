// ===== ==== ====
// IMPORTS
const { getBannedUserAndGroup } = require('../src/get-banned-user-and-group')
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
test('it has environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.GROUPS_TABLE_NAME).toBeDefined()
})

test('it returns banned user and group', async () => {
  const bannedUserId = 'banned-user-id'
  const groupId = 'group-id'
  ddbMock.on(BatchGetCommand, {
    RequestItems: {
      [process.env.USERS_TABLE_NAME]: {
        Keys: [{ id: bannedUserId }],
        ProjectionExpression: '#id, #groupId, #connectionId, #banConfirmedUsers, #group',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#groupId': 'groupId',
          '#group': 'group', // for backward compatibility
          '#connectionId': 'connectionId',
          '#banConfirmedUsers': 'banConfirmedUsers'
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
      [process.env.USERS_TABLE_NAME]: [{ id: bannedUserId }],
      [process.env.GROUPS_TABLE_NAME]: [{ id: groupId }]
    }
  })

  const response = await getBannedUserAndGroup(bannedUserId, groupId)

  expect(response).toStrictEqual({ bannedUser: { id: bannedUserId }, group: { id: groupId } })
})
