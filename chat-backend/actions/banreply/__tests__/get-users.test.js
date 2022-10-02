// ===== ==== ====
// IMPORTS
const { getUsers } = require('../src/get-users')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  BatchGetCommand
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

  // reset console
  log.mockReset()
})

// ===== ==== ====
// TESTS
test('it reads environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
})

test('it returns group users without forbidden users', async () => {
  const userIdA = 'user-id-a'
  const userIdB = 'user-id-b'
  ddbMock.on(BatchGetCommand).resolves({
    Responses: {
      [process.env.USERS_TABLE_NAME]: [{ id: userIdB }]
    }
  })
  const response = await getUsers({ userIds: new Set([userIdA, userIdB]), forbiddenUserIds: new Set([userIdA]) })

  expect(response).toEqual([{ id: userIdB }])
  expect(ddbMock).toHaveReceivedCommandWith(BatchGetCommand, {
    RequestItems: {
      [process.env.USERS_TABLE_NAME]: {
        // user and banned user already requested
        Keys: [{ id: userIdB }],
        ProjectionExpression: '#id, #connectionId, #firebaseToken',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId',
          '#firebaseToken': 'firebaseToken'
        }
      }
    }
  })
})

test('it returns empty group users when all users are forbidden', async () => {
  const userIdA = 'user-id-a'
  const userIdB = 'user-id-b'
  const response = await getUsers({ userIds: new Set([userIdA, userIdB]), forbiddenUserIds: new Set([userIdA, userIdB]) })

  expect(response).toEqual([])
  expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 0)
})
