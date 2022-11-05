// ===== ==== ====
// IMPORTS
const { sendMessageToGroup } = require('../src/send-message-to-group')
const getGroupUsersModule = require('../src/get-group-users')
const { mockClient } = require('aws-sdk-client-mock')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const snsMock = mockClient(SNSClient)

jest.mock('../src/get-group-users')

jest.spyOn(console, 'log')

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  snsMock.reset()

  snsMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it has environment variables', () => {
  expect(process.env.SEND_MESSAGE_TOPIC_ARN).toBeDefined()
  expect(process.env.SEND_NOTIFICATION_TOPIC_ARN).toBeDefined()
})

test('it sends message and notification', async () => {
  const groupId = 'group-id'
  const message = { message: 'message' }
  const notification = { message: 'notification' }
  const users = [{ id: 'user-a' }, { id: 'user-b' }, { id: 'user-c' }]
  getGroupUsersModule.getGroupUsers.mockResolvedValue(Promise.resolve(users))

  await sendMessageToGroup({
    groupId,
    message,
    notification
  })

  expect(getGroupUsersModule.getGroupUsers).toHaveBeenCalledTimes(1)
  expect(getGroupUsersModule.getGroupUsers).toHaveBeenCalledWith({ groupId })

  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users,
      message
    })
  })

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      topic: `group-${groupId}`,
      notification
    })
  })
})
