// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const getUserFromConnectionIdModule = require('../src/get-user-from-connection-id')
const getBannedUserModule = require('../src/get-banned-user')

const { mockClient } = require('aws-sdk-client-mock')

const getGroupModule = require('chat-backend-package/src/get-group')
jest.mock('chat-backend-package/src/get-group', () => ({
  getGroup: jest.fn()
}))

const {
  DynamoDBDocumentClient,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
jest.mock('../src/get-user-from-connection-id')
jest.mock('../src/get-banned-user')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // set custom variable
  process.env.CONFIRMATION_REQUIRED_STRING = '3'
  process.env.CONFIRMATION_REQUIRED = parseInt(process.env.CONFIRMATION_REQUIRED_STRING, 10)

  // reset mocks
  ddbMock.reset()
  snsMock.reset()

  ddbMock.resolves({})
  snsMock.resolves({})
})

// ===== ==== ====
// TESTS

test('it reads environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.SEND_MESSAGE_TOPIC_ARN).toBeDefined()
  expect(process.env.SEND_NOTIFICATION_TOPIC_ARN).toBeDefined()
  expect(process.env.CONFIRMATION_REQUIRED_STRING).toBeDefined()
  expect(process.env.CONFIRMATION_REQUIRED).toBeDefined()
})

test.each([
  { details: 'it rejects on undefined user id', groupId: 'group-id' },
  { details: 'it rejects on undefined group id', id: 'id' }
])('.test $details', async ({ id, groupId }) => {
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({})
  })

  expect(response).toEqual({
    message: 'user or group cannot be found',
    statusCode: 403
  })

  expect(getUserFromConnectionIdModule.getUserFromConnectionId).toHaveBeenCalledTimes(1)
  expect(getUserFromConnectionIdModule.getUserFromConnectionId).toHaveBeenCalledWith(connectionId)
})

test.each([
  { details: 'it throws on undefined bannedId', messageid: 'message-id' },
  { details: 'it throws on undefined messageId', bannedid: 'banned-id' }
])('.test $details', async ({ messageid, bannedid }) => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const connectionId = 'connectionId'
  await expect(handler({
    requestContext: { connectionId },
    body: JSON.stringify({ messageid, bannedid })
  })).rejects.toThrow('bannedid and messageid must be defined')
})

test('it rejects if user id and banned user id are the same', async () => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: id, messageid: 'message-id' })
  })

  expect(response).toEqual({
    message: `user (${id}) tried to ban itself`,
    statusCode: 403
  })
})

test.each([
  { details: 'with groupId', bannedUser: { id: 'banned-user-id', groupId: 'group-id-2' } },
  { details: 'with group', bannedUser: { id: 'banned-user-id', group: 'group-id-2' } }
])('it rejects if banned user and user not in the same group ($details)', async ({ bannedUser }) => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue({ id, groupId })

  getBannedUserModule.getBannedUser.mockResolvedValue({ bannedUser })

  // call handler
  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: bannedUser.id, messageid: 'message-id' })
  })

  // expect
  expect(response).toEqual({
    message: `user (${id}) and banned user (${bannedUser.id}) are not in the same group`,
    statusCode: 403
  })

  expect(getBannedUserModule.getBannedUser).toHaveBeenCalledTimes(1)
  expect(getBannedUserModule.getBannedUser).toHaveBeenCalledWith(bannedUser.id)
})

test('it updates banned user if no new user in the vote', async () => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue({ id, groupId })

  const bannedUserId = 'banned-user-id'
  getBannedUserModule.getBannedUser.mockResolvedValue({
    bannedUser: { id: bannedUserId, groupId, banConfirmedUsers: new Set([id]) }
  })

  getGroupModule.getGroup.mockResolvedValue({
    group: { id: groupId, isPublic: true },
    users: [{ id }, { id: bannedUserId }]
  })

  // call handler
  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: bannedUserId, messageid: 'message-id' })
  })

  // expect
  expect(response).toStrictEqual({ statusCode: 200 })

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
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const bannedUserId = 'banned-user-id'
  getBannedUserModule.getBannedUser.mockResolvedValue({
    bannedUser: { id: bannedUserId, groupId }
  })

  // get users
  const firebaseToken = 'firebase-token'
  const connectionId = 'connection-id'
  getGroupModule.getGroup.mockResolvedValue({
    group: { id: groupId, isPublic: true },
    users: [{ id, connectionId, firebaseToken }, { id: bannedUserId }]
  })

  // call handler
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: bannedUserId, messageid: 'message-id' })
  })

  // expect
  expect(response).toEqual({ statusCode: 200 })
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
      ':banNewVotingUsers': new Set([id])
    }
  })

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, connectionId, firebaseToken }],
      message: {
        action: 'ban-request',
        messageid: 'message-id'
      }
    })
  })
  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, connectionId, firebaseToken }],
      notification: {
        title: "Quelqu'un a mal agi ❌",
        body: 'Viens donner ton avis !'
      }
    })
  })
})
