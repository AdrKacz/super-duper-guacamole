// ===== ==== ====
// IMPORTS
const { leaveGroup } = require('../leave-group')
const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('../clients/aws/dynamo-db-client')

const { UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')

const getGroupModule = require('../get-group')
jest.mock('../get-group', () => ({ getGroup: jest.fn() }))

const sendMessagesModule = require('../send-messages')
jest.mock('../send-messages', () => ({ sendMessages: jest.fn() }))

const sendNotificationsModule = require('../send-notifications')
jest.mock('../send-notifications', () => ({ sendNotifications: jest.fn() }))

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

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(0)
})

test('it throws if group is private', async () => {
  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: false, groupSize: 2 },
    users: [{ id: 'id' }, { id: 'id-1' }]
  })

  await expect(
    leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })
  ).rejects.toThrow('you cannot change group yet')

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id' })
})

test('it returns if group is not defined', async () => {
  getGroupModule.getGroup.mockRejectedValue(new Error('group (group-id) is not defined'))

  await leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)
  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(0)
})

test('it throws if error while getting group', async () => {
  getGroupModule.getGroup.mockRejectedValue(new Error('unknown error'))

  await expect(
    leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })
  ).rejects.toThrow('unknown error')

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)
  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(0)
})

test('it updates group if more than one user remaining', async () => {
  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true, groupSize: 3 },
    users: [{ id: 'id' }, { id: 'id-1' }, { id: 'id-2' }]
  })

  await leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 2)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    ConditionExpression: '#groupId = :groupId',
    UpdateExpression: 'REMOVE #groupId, #banVotingUsers, #banConfirmedUsers, #confirmationRequired',
    ExpressionAttributeNames: {
      '#groupId': 'groupId',
      '#banVotingUsers': 'banVotingUsers',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#confirmationRequired': 'confirmationRequired'
    },
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

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({ users: [{ id: 'id-1' }, { id: 'id-2' }], message: { action: 'update-status' }, useSaveMessage: false })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    notification: {
      title: 'Le groupe rétrécit 😔',
      body: 'Quelqu\'un a quitté le groupe ...'
    }
  })
})

test('it deletes group if less than two user remaining', async () => {
  getGroupModule.getGroup.mockResolvedValue({
    group: { id: 'group-id', isPublic: true, groupSize: 2 },
    users: [{ id: 'id' }, { id: 'id-1' }]
  })

  await leaveGroup({ currentUser: { id: 'id', groupId: 'group-id' } })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    ConditionExpression: '#groupId = :groupId',
    UpdateExpression: 'REMOVE #groupId, #banVotingUsers, #banConfirmedUsers, #confirmationRequired',
    ExpressionAttributeNames: {
      '#groupId': 'groupId',
      '#banVotingUsers': 'banVotingUsers',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#confirmationRequired': 'confirmationRequired'
    },
    ExpressionAttributeValues: { ':groupId': 'group-id' }
  })

  expect(ddbMock).toHaveReceivedCommandTimes(DeleteCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(DeleteCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: 'group-id' }
  })

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({ users: [{ id: 'id-1' }], message: { action: 'update-status' }, useSaveMessage: false })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-1' }],
    notification: {
      title: 'Ton groupe est vide 😔',
      body: 'Reconnecte toi pour demander un nouveau groupe ...'
    }
  })
})
