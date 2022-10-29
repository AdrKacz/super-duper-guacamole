// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const { mockClient } = require('aws-sdk-client-mock')

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} = require('@aws-sdk/client-apigatewaymanagementapi')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const apiMock = mockClient(ApiGatewayManagementApiClient)
const snsMock = mockClient(SNSClient)

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
// reset mocks
  apiMock.reset()
  snsMock.reset()

  apiMock.resolves({})
  snsMock.reset()

  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test('it throws error when users is undefined', async () => {
  await expect(handler({
    Records: [{
      Sns: {
        Message: JSON.stringify({})
      }
    }]
  })).rejects.toThrow('users and message must be defined')
})

test('it sends message', async () => {
  apiMock.on(PostToConnectionCommand, {
    ConnectionId: 'connection-id-1',
    Data: JSON.stringify({ action: 'action' })
  }).resolves()

  apiMock.on(PostToConnectionCommand, {
    ConnectionId: 'connection-id-2',
    Data: JSON.stringify({ action: 'action' })
  }).rejects()

  await handler({
    Records: [{
      Sns: {
        Message: JSON.stringify({
          users: [{ id: 'id-1', connectionId: 'connection-id-1' }, { id: 'id-2', connectionId: 'connection-id-2' }, { id: 'id-3' }],
          message: { action: 'action' }
        })
      }
    }]
  })

  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.STORE_UNREAD_DATA_TOPIC_ARN, // it removes connectionId too
    Message: JSON.stringify({
      users: [{ id: 'id-3' }, { id: 'id-2', connectionId: 'connection-id-2' }],
      message: { action: 'action' }
    })
  })
})
