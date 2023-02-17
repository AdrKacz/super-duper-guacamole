// ===== ==== ====
// IMPORTS
const { disconnectUser } = require('../disconnect-user')

const { mockClient } = require('aws-sdk-client-mock')
const { dynamoDBDocumentClient } = require('../clients/aws/dynamo-db-client')
const ddbMock = mockClient(dynamoDBDocumentClient)

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const getUserModule = require('../get-user')
jest.mock('../get-user', () => ({ getUser: jest.fn() }))

const getGroupModule = require('../get-group')
jest.mock('../get-group', () => ({ getGroup: jest.fn() }))

const sendMessagesModule = require('../send-messages')
jest.mock('../send-messages', () => ({ sendMessages: jest.fn() }))

// ===== ==== ====
// TESTS
test('it updates connection id', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })

  await disconnectUser({
    id: 'id',
    connectionId: 'connection-id'
  })

  expect(getUserModule.getUser).toHaveBeenCalledWith({ id: 'id' })
  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(0)

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: 'REMOVE #connectionId',
    ConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: { '#connectionId': 'connectionId' },
    ExpressionAttributeValues: { ':connectionId': 'connection-id' }
  })
})

test('it send messages to group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { id: 'group-id', isPublic: true }, users: [{ id: 'id' }, { id: 'id-2' }] })

  await disconnectUser({
    id: 'id',
    connectionId: 'connection-id'
  })

  expect(getUserModule.getUser).toHaveBeenCalledTimes(1)
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id' })

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    message: {
      action: 'disconnect',
      id: 'id'
    },
    useSaveMessage: false
  })
})

test('it throws unknown error', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockRejectedValue(new Error('unknown error'))

  await expect(disconnectUser({
    id: 'id',
    connectionId: 'connection-id'
  })).rejects.toThrow('unknown error')

  expect(getUserModule.getUser).toHaveBeenCalledTimes(1)
  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(0)
})
