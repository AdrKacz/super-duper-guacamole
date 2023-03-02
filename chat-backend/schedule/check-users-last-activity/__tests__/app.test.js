// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')
const { ScanCommand } = require('@aws-sdk/lib-dynamodb')

const getGroupModule = require('chat-backend-package/src/get-group') // skipcq: JS-0260
jest.mock('chat-backend-package/src/get-group', () => ({
  getGroup: jest.fn()
}))

const sendNotificationsModule = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260
jest.mock('chat-backend-package/src/send-notifications', () => ({
  sendNotifications: jest.fn()
}))

Date.now = jest.fn()

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(dynamoDBDocumentClient)

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()
  ddbMock.resolves({})

  jest.useFakeTimers()
  jest.setSystemTime(new Date(Date.UTC(2023, 0, 16, 12, 0, 0)))
})

// ===== ==== ====
// AFTER EACH
afterEach(() => {
  jest.useRealTimers()
})

// ===== ==== ====
// TESTS
test('it loops over all impacted users', async () => {
  ddbMock
    .on(ScanCommand)
    .resolves({
      Items: [{ id: 'id-1' }, { id: 'id-2' }],
      LastEvaluatedKey: 'id-2'
    })
    .on(ScanCommand, {
      ExclusiveStartKey: 'id-2'
    })
    .resolves({
      Items: [{ id: 'id-3' }]
    })

  const groups = {
    'id-1': [{ id: 'id-11', lastConnectionDay: '2023-01-15' }, { id: 'id-12', lastConnectionDay: '2023-01-16' }],
    'id-2': [{ id: 'id-21' }],
    'id-3': [{ id: 'id-31', lastConnectionDay: '2023-01-13' }, { id: 'id-32' }]
  }

  getGroupModule.getGroup.mockImplementation(({ groupId }) => {
    if (groupId === 'id-2') {
      throw new Error('Unknown error')
    } else {
      return {
        group: { id: groupId },
        users: groups[groupId]
      }
    }
  })

  await handler()

  expect(ddbMock).toHaveReceivedCommandTimes(ScanCommand, 2)
  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(3)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-11', lastConnectionDay: '2023-01-15' },
      { id: 'id-31', lastConnectionDay: '2023-01-13' },
      { id: 'id-32' }],
    notification: {
      title: 'Viens donner de tes nouvelles 🎉',
      body: 'Ton groupe a besoin de toi !'
    }
  })
})
