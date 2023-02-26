// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')

const getBannedUserModule = require('../src/get-banned-user')
jest.mock('../src/get-banned-user')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const ddbMock = mockClient(dynamoDBDocumentClient)

const getUserModule = require('chat-backend-package/src/get-user')
jest.mock('chat-backend-package/src/get-user', () => ({ getUser: jest.fn() }))

const getGroupModule = require('chat-backend-package/src/get-group')
jest.mock('chat-backend-package/src/get-group', () => ({ getGroup: jest.fn() }))

const sendMessagesModule = require('chat-backend-package/src/send-messages')
jest.mock('chat-backend-package/src/send-messages', () => ({ sendMessages: jest.fn() }))

const sendNotificationsModule = require('chat-backend-package/src/send-notifications')
jest.mock('chat-backend-package/src/send-notifications', () => ({ sendNotifications: jest.fn() }))

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // set custom variable
  process.env.CONFIRMATION_REQUIRED_STRING = '3'
  process.env.CONFIRMATION_REQUIRED = parseInt(process.env.CONFIRMATION_REQUIRED_STRING, 10)

  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it returns if no group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: 'banned-user-id', status: 'confirmed' })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: 'you don\'t have a group' })
  }))
})

test('it rejects on undefined bannedId', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({})
  })

  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: 'you didn\'t send a valid bannedid' })
  }))
})

test('it rejects if user id and banned user id are the same', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: 'id' })
  })

  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: 'you can\'t ban yourself' })
  }))
})

test.each([
  { details: 'with groupId', bannedUser: { id: 'banned-user-id', groupId: 'group-id-2' } },
  { details: 'with group', bannedUser: { id: 'banned-user-id', group: 'group-id-2' } }
])('it rejects if banned user and user not in the same group ($details)', async ({ bannedUser }) => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  getBannedUserModule.getBannedUser.mockResolvedValue({ bannedUser })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUser.id })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: 'you are not in the same group as the user banned' })
  }))

  expect(getBannedUserModule.getBannedUser).toHaveBeenCalledTimes(1)
  expect(getBannedUserModule.getBannedUser).toHaveBeenCalledWith(bannedUser.id)
})

test('it updates banned user if no new user in the vote', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  const bannedUserId = 'banned-user-id'
  getBannedUserModule.getBannedUser.mockResolvedValue({
    bannedUser: { id: bannedUserId, groupId: 'group-id', banConfirmedUsers: new Set(['id']) }
  })

  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true },
    users: [{ id: 'id' }, { id: bannedUserId }]
  })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUserId })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id' })
  }))

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: bannedUserId },
    UpdateExpression: `

SET #confirmationRequired = :confirmationRequired
`,
    ExpressionAttributeNames: {
      '#confirmationRequired': 'confirmationRequired'
    },
    ExpressionAttributeValues: {
      ':confirmationRequired': Math.min(process.env.CONFIRMATION_REQUIRED, 1) // groups.users.size - 1 = 2 - 1
    }
  })
})

test('it updates banned user if new user in the vote', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  const bannedUserId = 'banned-user-id'
  getBannedUserModule.getBannedUser.mockResolvedValue({
    bannedUser: { id: bannedUserId, groupId: 'group-id' }
  })

  // get users
  const firebaseToken = 'firebase-token'
  const connectionId = 'connection-id'
  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true },
    users: [{ id: 'id', connectionId, firebaseToken }, { id: bannedUserId }]
  })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUserId })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id' })
  }))

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: bannedUserId },
    UpdateExpression: `
ADD #banVotingUsers :banNewVotingUsers
SET #confirmationRequired = :confirmationRequired
`,
    ExpressionAttributeNames: {
      '#confirmationRequired': 'confirmationRequired',
      '#banVotingUsers': 'banVotingUsers'
    },
    ExpressionAttributeValues: {
      ':confirmationRequired': Math.min(process.env.CONFIRMATION_REQUIRED, 1), // groups.users.size - 1 = 2 - 1
      ':banNewVotingUsers': new Set(['id'])
    }
  })

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({
    users: [{ id: 'id', connectionId, firebaseToken }],
    message: { action: 'ban-request', id: 'banned-user-id' },
    useSaveMessage: true
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id', connectionId, firebaseToken }],
    notification: {
      title: "Quelqu'un a mal agi ❌",
      body: 'Viens donner ton avis !'
    }
  })
})
