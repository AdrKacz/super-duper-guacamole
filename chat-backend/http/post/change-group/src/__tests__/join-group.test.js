// ===== ==== ====
// IMPORTS
const { joinGroup } = require('../join-group')
const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const chatBackendPackageModule = require('chat-backend-package')
jest.mock('chat-backend-package', () => ({
  sendMessages: jest.fn(),
  sendNotifications: jest.fn()
}))

// ===== ==== ====
// CONSTANTS
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
test('it handles already public group', async () => {
  const currentUser = { id: 'id', blockedUserIds: new Set(), groupId: 'group-id' }
  const group = { id: 'group-id', isPublic: true }
  const users = [{ id: 'id-1' }]

  await expect(joinGroup({ currentUser, group, users })).rejects.toThrow('you can only join a private group')

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 0)
  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledTimes(0)
  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledTimes(0)
})

test('it handles already private group that turns public', async () => {
  const currentUser = { id: 'id', blockedUserIds: new Set(), groupId: 'group-id' }
  const group = { id: 'group-id', isPublic: false }
  const users = [{ id: 'id-1' }, { id: 'id-2' }]
  await joinGroup({ currentUser, group, users })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 2)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: 'SET #groupId = :groupId',
    ExpressionAttributeNames: { '#groupId': 'groupId' },
    ExpressionAttributeValues: { ':groupId': 'group-id' }
  })
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group-id' },
    UpdateExpression: 'SET #isPublic = :isPublic',
    ExpressionAttributeNames: { '#isPublic': 'isPublic' },
    ExpressionAttributeValues: { ':isPublic': true }
  })

  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledWith({ users: users.concat([currentUser]), message: { action: 'update-status' }, useSaveMessage: false })

  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledWith({
    users: users.concat([currentUser]),
    notification: {
      title: 'Viens te présenter 🥳',
      body: 'Je viens de te trouver un groupe !'
    }
  })
})

test('it handles already private group that keeps private', async () => {
  const currentUser = { id: 'id', blockedUserIds: new Set(), groupId: 'group-id' }
  const group = { id: 'group-id', isPublic: false }
  const users = [{ id: 'id-1' }]
  await joinGroup({ currentUser, group, users })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 2)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: 'SET #groupId = :groupId',
    ExpressionAttributeNames: { '#groupId': 'groupId' },
    ExpressionAttributeValues: { ':groupId': 'group-id' }
  })
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group-id' },
    UpdateExpression: 'SET #isPublic = :isPublic',
    ExpressionAttributeNames: { '#isPublic': 'isPublic' },
    ExpressionAttributeValues: { ':isPublic': false }
  })

  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledTimes(0)

  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledTimes(0)
})

test('it handles blocked users', async () => {
  const currentUser = { id: 'id', blockedUserIds: new Set(['id-3']), groupId: 'group-id' }
  const group = { id: 'group-id', isPublic: false }
  const users = [{ id: 'id-1' }]
  await joinGroup({ currentUser, group, users })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 2)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: 'SET #groupId = :groupId',
    ExpressionAttributeNames: { '#groupId': 'groupId' },
    ExpressionAttributeValues: { ':groupId': 'group-id' }
  })
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group-id' },
    UpdateExpression: `
SET #isPublic = :isPublic
ADD #bannedUserIds :blockedUserIds`,
    ExpressionAttributeNames: {
      '#isPublic': 'isPublic',
      '#bannedUserIds': 'bannedUserIds'
    },
    ExpressionAttributeValues: {
      ':isPublic': false,
      ':blockedUserIds': new Set(['id-3'])
    }
  })

  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledTimes(0)

  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledTimes(0)
})
