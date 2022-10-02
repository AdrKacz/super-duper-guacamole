// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const getUserFromConnectionIdModule = require('../src/get-user-from-connection-id')
const closeVoteModule = require('../src/close-vote')
const getUserAndBannedUserAndGroupModule = require('../src/get-user-and-banned-user-and-group')
const getUsersModule = require('../src/get-users')

const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
jest.mock('../src/get-user-from-connection-id')
jest.mock('../src/close-vote')
jest.mock('../src/get-user-and-banned-user-and-group')
jest.mock('../src/get-users')

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

// ===== ==== ====
// TESTS
test('it reads environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.SEND_MESSAGE_TOPIC_ARN).toBeDefined()
  expect(process.env.SEND_NOTIFICATION_TOPIC_ARN).toBeDefined()
  expect(process.env.SWITCH_GROUP_TOPIC_ARN).toBeDefined()
})

test.each([
  { details: 'it rejects on undefined user id', groupId: 'group-id' },
  { details: 'it rejects on undefined group id', id: 'id' }
])('.test $details', async ({ id, groupId }) => {
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const connectionId = 'connection-id'
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
  { details: 'it throws on undefined bannedId', body: { status: 'confirmed' } },
  { details: 'it throws on undefined status', body: { bannedid: 'bannedId' } },
  { details: 'it throws if status is not in the set of accepted values', body: { bannedid: 'bannedId', status: 'not accepted' } }
])('.test $details', async ({ body }) => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const connectionId = 'connectionId'
  await expect(handler({
    requestContext: { connectionId },
    body: JSON.stringify(body)
  })).rejects.toThrow("bannedid must be defined, and status must be either 'confirmed' or 'denied'")
})

test.each([
  { details: 'banned user and user not in the same group (with groupId)', bannedUser: { id: 'banned-user-id', groupId: 'group-id-2', confirmationRequired: 1 } },
  { details: 'banned user and user not in the same group (with group)', bannedUser: { id: 'banned-user-id', group: 'group-id-2', confirmationRequired: 1 } },
  { details: 'banned user have confirmationRequired undefined', bannedUser: { id: 'banned-user-id', group: 'group-id' } }
])('it rejects if $details', async ({ bannedUser }) => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  getUserAndBannedUserAndGroupModule.getUserAndBannedUserAndGroup.mockResolvedValue(Promise.resolve({
    user: { id, groupId },
    bannedUser,
    group: { id: groupId }
  }))

  // call handler
  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: bannedUser.id, status: 'confirmed' })
  })

  // expect
  expect(response).toEqual({
    message: `user (${id}) and banned user (${bannedUser.id}) are not in the same group or confirmationRequired is not defined (not in an active ban)`,
    statusCode: 403
  })

  expect(getUserAndBannedUserAndGroupModule.getUserAndBannedUserAndGroup).toHaveBeenCalledTimes(1)
  expect(getUserAndBannedUserAndGroupModule.getUserAndBannedUserAndGroup).toHaveBeenCalledWith({ id, bannedUserId: bannedUser.id, groupId })
})

test.each([
  { details: 'set of voting users undefined', bannedUser: { id: 'banned-user-id', groupId: 'group-id', confirmationRequired: 1 } },
  { details: 'user not in set of voting users', bannedUser: { id: 'banned-user-id', groupId: 'group-id', confirmationRequired: 1, banVotingUsers: new Set(['other-user-id']) } }
])('it rejects if user is not in banned user set of voting users ($details)', async ({ bannedUser }) => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  getUserAndBannedUserAndGroupModule.getUserAndBannedUserAndGroup.mockResolvedValue(Promise.resolve({
    user: { id, groupId },
    bannedUser,
    group: { id: groupId }
  }))

  // call handler
  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: bannedUser.id, status: 'confirmed' })
  })

  // expect
  expect(response).toEqual({
    message: `user (${id}) is not in banVotingUsers (below) of banned user (${bannedUser.id})`,
    statusCode: 403
  })
})

test.each([
  { details: 'banConfirmedUsers undefined', updatedBannedUser: { banVotingUsers: new Set(['dummy-other-user-id']) }, confirmationRequired: 1 },
  { details: 'banConfirmedUsers defined', updatedBannedUser: { banConfirmedUsers: new Set(), banVotingUsers: new Set(['dummy-other-user-id']) }, confirmationRequired: 1 }
])('it updates banned user (status confirmed) ($details)', async ({ updatedBannedUser, confirmationRequired }) => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const bannedUserId = 'banned-user-id'
  getUserAndBannedUserAndGroupModule.getUserAndBannedUserAndGroup.mockResolvedValue(Promise.resolve({
    user: { id, groupId },
    bannedUser: { id: bannedUserId, groupId, confirmationRequired, banVotingUsers: new Set([id]) },
    group: { id: groupId }
  }))

  ddbMock.on(UpdateCommand).resolves({
    Attributes: updatedBannedUser
  })

  // call handler
  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: bannedUserId, status: 'confirmed' })
  })

  // expect
  expect(response).toEqual({
    statusCode: 200
  })

  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 0)

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
      ':id': new Set([id])
    }
  })
})

test('it notifies user if the vote ended with a confirmation', async () => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const bannedUserId = 'banned-user-id'
  getUserAndBannedUserAndGroupModule.getUserAndBannedUserAndGroup.mockResolvedValue(Promise.resolve({
    user: { id, groupId },
    bannedUser: { id: bannedUserId, groupId, confirmationRequired: 1, banVotingUsers: new Set([id]) },
    group: { id: groupId, users: new Set([id, bannedUserId]) }
  }))

  ddbMock.on(UpdateCommand).resolves({
    Attributes: {
      banConfirmedUsers: new Set([id]) // size 1 and confirmationRequired 1 implies voteConfirmed
    }
  })

  getUsersModule.getUsers.mockResolvedValue(Promise.resolve([]))

  // call handler
  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ bannedid: bannedUserId, status: 'confirmed' })
  })

  // expect
  expect(response).toEqual({
    statusCode: 200
  })

  expect(getUsersModule.getUsers).toHaveBeenCalledTimes(1)
  expect(getUsersModule.getUsers).toHaveBeenCalledWith({
    userIds: new Set([id, bannedUserId]),
    forbiddenUserIds: new Set([id, bannedUserId])
  })

  expect(closeVoteModule.closeVote).toHaveBeenCalledTimes(1)
  expect(closeVoteModule.closeVote).toHaveBeenCalledWith({
    user: { id, groupId },
    bannedUser: { id: bannedUserId, groupId, confirmationRequired: 1, banVotingUsers: new Set([id]) },
    otherUsers: []
  })

  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 3)

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SWITCH_GROUP_TOPIC_ARN,
    Message: JSON.stringify({
      id: bannedUserId,
      groupid: groupId,
      isBan: true
    })
  })

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, groupId }, { id: bannedUserId, groupId, confirmationRequired: 1, banVotingUsers: new Set([]) }],
      message: {
        action: 'banreply',
        bannedid: bannedUserId,
        status: 'confirmed'
      }
    })
  })

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id: bannedUserId, groupId, confirmationRequired: 1, banVotingUsers: new Set([]) }],
      notification: {
        title: 'Tu as mal agi ❌',
        body: "Ton groupe t'a exclu"
      }
    })
  })
})

test('it notifies user if the vote ended with a denial', async () => {
  const id = 'id'
  const groupId = 'group-id'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  const bannedUserId = 'banned-user-id'
  getUserAndBannedUserAndGroupModule.getUserAndBannedUserAndGroup.mockResolvedValue(Promise.resolve({
    user: { id, groupId },
    bannedUser: { id: bannedUserId, groupId, confirmationRequired: 1, banVotingUsers: new Set([id]) },
    group: { id: groupId, users: new Set([id, bannedUserId]) }
  }))

  // update banned user
  ddbMock.on(UpdateCommand).resolves({ Attributes: {} }) // no banVotingUsers and no banConfirmedUsers and confirmationRequired 1 implies voteDenied

  // call handler
  const connectionId = 'connectionId'
  const response = await handler({
    requestContext: { connectionId },
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
      ':id': new Set([id])
    }
  })

  expect(response).toEqual({
    statusCode: 200
  })

  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, groupId }],
      message: {
        action: 'banreply',
        bannedid: bannedUserId,
        status: 'denied'
      }
    })
  })
})
