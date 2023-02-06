// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const getUserAndBannedUserModule = require('../src/get-user-and-banned-user')
jest.mock('../src/get-user-and-banned-user')

const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')

const leaveGroupModule = require('chat-backend-package/src/leave-group')
jest.mock('chat-backend-package/src/leave-group', () => ({ leaveGroup: jest.fn() }))

const getUserModule = require('chat-backend-package/src/get-user')
jest.mock('chat-backend-package/src/get-user', () => ({ getUser: jest.fn() }))

const getGroupModule = require('chat-backend-package/src/get-group')
jest.mock('chat-backend-package/src/get-group', () => ({ getGroup: jest.fn() }))

const sendMessagesModule = require('chat-backend-package/src/send-messages')
jest.mock('chat-backend-package/src/send-messages', () => ({ sendMessages: jest.fn() }))

const sendNotificationsModule = require('chat-backend-package/src/send-notifications')
jest.mock('chat-backend-package/src/send-notifications', () => ({ sendNotifications: jest.fn() }))

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const ddbMock = mockClient(dynamoDBDocumentClient)

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
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

test.each([
  { details: 'it throws on undefined bannedId', body: { status: 'confirmed' } },
  { details: 'it throws on undefined status', body: { bannedUserId: 'bannedId' } },
  { details: 'it throws if status is not in the set of accepted values', body: { bannedUserId: 'bannedId', status: 'not accepted' } }
])('.test $details', async ({ body }) => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  await expect(handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify(body)
  })).rejects.toThrow("bannedid must be defined, and status must be either 'confirmed' or 'denied'")
})

test.each([
  { details: 'banned user and user not in the same group (with groupId)', bannedUser: { id: 'banned-user-id', groupId: 'group-id-2', confirmationRequired: 1 } },
  { details: 'banned user and user not in the same group (with group)', bannedUser: { id: 'banned-user-id', group: 'group-id-2', confirmationRequired: 1 } },
  { details: 'banned user have confirmationRequired undefined', bannedUser: { id: 'banned-user-id', group: 'group-id' } }
])('it rejects if $details', async ({ bannedUser }) => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  getUserAndBannedUserModule.getUserAndBannedUser.mockResolvedValue({
    user: { id: 'id', groupId: 'group-id' },
    bannedUser
  })

  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true },
    users: []
  })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUser.id, status: 'confirmed' })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: 'you are not in the same group as the user banned or banned user is not in a ban vote' })
  }))

  expect(getUserAndBannedUserModule.getUserAndBannedUser).toHaveBeenCalledTimes(1)
  expect(getUserAndBannedUserModule.getUserAndBannedUser).toHaveBeenCalledWith({ id: 'id', bannedUserId: bannedUser.id })
})

test.each([
  { details: 'set of voting users undefined', bannedUser: { id: 'banned-user-id', groupId: 'group-id', confirmationRequired: 1 } },
  { details: 'user not in set of voting users', bannedUser: { id: 'banned-user-id', groupId: 'group-id', confirmationRequired: 1, banVotingUsers: new Set(['other-user-id']) } }
])('it rejects if user is not in banned user set of voting users ($details)', async ({ bannedUser }) => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  getUserAndBannedUserModule.getUserAndBannedUser.mockResolvedValue({
    user: { id: 'id', groupId: 'group-id' },
    bannedUser
  })

  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true },
    users: []
  })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUser.id, status: 'confirmed' })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: `you cannot vote against (${bannedUser.id})` })
  }))
})

test.each([
  { details: 'banConfirmedUsers undefined', updatedBannedUser: { banVotingUsers: new Set(['dummy-other-user-id']) }, confirmationRequired: 1 },
  { details: 'banConfirmedUsers defined', updatedBannedUser: { banConfirmedUsers: new Set(), banVotingUsers: new Set(['dummy-other-user-id']) }, confirmationRequired: 1 }
])('it updates banned user (status confirmed) ($details)', async ({ updatedBannedUser, confirmationRequired }) => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  const bannedUserId = 'banned-user-id'
  getUserAndBannedUserModule.getUserAndBannedUser.mockResolvedValue({
    user: { id: 'id', groupId: 'group-id' },
    bannedUser: { id: bannedUserId, groupId: 'group-id', confirmationRequired, banVotingUsers: new Set(['id']) }
  })

  ddbMock.on(UpdateCommand).resolves({
    Attributes: updatedBannedUser
  })

  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true },
    users: []
  })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUserId, status: 'confirmed' })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id' })
  }))

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    ReturnValues: 'ALL_NEW',
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: bannedUserId },
    UpdateExpression: `
ADD #banConfirmedUsers :id
DELETE #banVotingUsers :id
`,
    ExpressionAttributeNames: {
      '#banVotingUsers': 'banVotingUsers',
      '#banConfirmedUsers': 'banConfirmedUsers'
    },
    ExpressionAttributeValues: {
      ':id': new Set(['id'])
    }
  })
})

test('it notifies user if the vote ended with a confirmation', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  const bannedUserId = 'banned-user-id'
  getUserAndBannedUserModule.getUserAndBannedUser.mockResolvedValue({
    user: { id: 'id', groupId: 'group-id' },
    bannedUser: { id: bannedUserId, groupId: 'group-id', confirmationRequired: 1, banVotingUsers: new Set(['id']) }
  })

  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true },
    users: [{ id: 'id' }, { id: bannedUserId }]
  })

  ddbMock.on(UpdateCommand).resolves({
    Attributes: {
      banConfirmedUsers: new Set(['id']) // size 1 and confirmationRequired 1 implies voteConfirmed
    }
  })

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUserId, status: 'confirmed' })
  })

  // expect
  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id' })
  }))

  expect(leaveGroupModule.leaveGroup).toHaveBeenCalledTimes(1)
  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(2)

  expect(leaveGroupModule.leaveGroup).toHaveBeenCalledWith({ currentUser: { id: bannedUserId, groupId: 'group-id', confirmationRequired: 1, banVotingUsers: new Set(['id']) } })

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({
    users: [{ id: 'id', groupId: 'group-id' }, { id: bannedUserId, groupId: 'group-id', confirmationRequired: 1, banVotingUsers: new Set(['id']) }],
    message: {
      action: 'ban-reply',
      bannedid: bannedUserId,
      status: 'confirmed'
    },
    useSaveMessage: true
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: bannedUserId, groupId: 'group-id', confirmationRequired: 1, banVotingUsers: new Set(['id']) }],
    notification: {
      title: 'Tu as mal agi ❌',
      body: "Ton groupe t'a exclu"
    }
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id', groupId: 'group-id' }],
    notification: {
      title: 'Le vote est terminé 🗳',
      body: 'Viens voir le résultat !'
    }
  })
})

test('it notifies user if the vote ended with a denial', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })

  const bannedUserId = 'banned-user-id'
  getUserAndBannedUserModule.getUserAndBannedUser.mockResolvedValue({
    user: { id: 'id', groupId: 'group-id' },
    bannedUser: { id: bannedUserId, groupId: 'group-id', confirmationRequired: 1, banVotingUsers: new Set(['id']) }
  })

  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true },
    users: [{ id: 'id' }, { id: bannedUserId }]
  })
  // update banned user
  ddbMock.on(UpdateCommand).resolves({ Attributes: {} }) // no banVotingUsers and no banConfirmedUsers and confirmationRequired 1 implies voteDenied

  // call handler
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ bannedid: bannedUserId, status: 'denied' })
  })

  // expect
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    ReturnValues: 'ALL_NEW',
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: bannedUserId },
    UpdateExpression: `

DELETE #banVotingUsers :id
`,
    ExpressionAttributeNames: {
      '#banVotingUsers': 'banVotingUsers'
    },
    ExpressionAttributeValues: {
      ':id': new Set(['id'])
    }
  })

  expect(JSON.stringify(response)).toEqual(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id' })
  }))

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({
    users: [{ id: 'id', groupId: 'group-id' }],
    message: {
      action: 'ban-reply',
      bannedid: bannedUserId,
      status: 'denied'
    },
    useSaveMessage: true
  })
})
