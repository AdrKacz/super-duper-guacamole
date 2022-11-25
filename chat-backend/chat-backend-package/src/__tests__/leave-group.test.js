// ===== ==== ====
// IMPORTS
const { leaveGroup } = require('../leave-group')
const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')

const { UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')

const chatBackendPackageModule = require('chat-backend-package')
jest.mock('chat-backend-package', () => ({
  getGroup: jest.fn(),
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
test('it returns if group id is not a string', async () => {
  await leaveGroup({ currentUser: { id: 'id' } })

  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledTimes(0)
})

test('it throws if group is private', async () => {
  chatBackendPackageModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: false, groupSize: 2 },
    users: [{ id: 'id' }, { id: 'id-1' }]
  })

  await expect(
    leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })
  ).rejects.toThrow('you cannot change group yet')

  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id' })
})

test('it updates group if more than one user remaining', async () => {
  chatBackendPackageModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true, groupSize: 3 },
    users: [{ id: 'id' }, { id: 'id-1' }, { id: 'id-2' }]
  })

  await leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 2)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    ConditionExpression: '#groupId = :groupId',
    UpdateExpression: 'REMOVE #groupId',
    ExpressionAttributeNames: { '#groupId': 'groupId' },
    ExpressionAttributeValues: { ':groupId': 'group-id' }
  })
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group-id' },
    ReturnValues: 'UPDATED_NEW',
    UpdateExpression: 'SET #groupSize = :groupSize',
    ExpressionAttributeNames: { '#groupSize': 'groupSize' },
    ExpressionAttributeValues: { ':groupSize': 2 }
  })

  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledWith({ users: [{ id: 'id-1' }, { id: 'id-2' }], message: { action: 'update-status' }, useSaveMessage: false })

  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    notification: {
      title: 'Le groupe rétrécit 😔',
      body: 'Quelqu\'un a quitté le groupe ...'
    }
  })
})

test('it deletes group if less than two user remaining', async () => {
  chatBackendPackageModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true, groupSize: 2 },
    users: [{ id: 'id' }, { id: 'id-1' }]
  })

  await leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    ConditionExpression: '#groupId = :groupId',
    UpdateExpression: 'REMOVE #groupId',
    ExpressionAttributeNames: { '#groupId': 'groupId' },
    ExpressionAttributeValues: { ':groupId': 'group-id' }
  })

  expect(ddbMock).toHaveReceivedCommandTimes(DeleteCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(DeleteCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group-id' },
    ConditionExpression: '#groupSize <= :one',
    ExpressionAttributeNames: { '#groupSize': 'groupSize' },
    ExpressionAttributeValues: { ':one': 1 }
  })

  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledWith({ users: [{ id: 'id-1' }], message: { action: 'update-status' }, useSaveMessage: false })

  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-1' }],
    notification: {
      title: 'Ton groupe est vide 😔',
      body: 'Reconnecte toi pour demander un nouveau groupe ...'
    }
  })
})
