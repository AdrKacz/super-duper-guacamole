// ===== ==== ====
// IMPORTS
const { sendMessage } = require('../src/send-message')
const { mockClient } = require('aws-sdk-client-mock')

const saveMessageModule = require('../src/helpers/save-message')

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} = require('@aws-sdk/client-apigatewaymanagementapi')

// ===== ==== ====
// CONSTANTS
const apiMock = mockClient(ApiGatewayManagementApiClient)

jest.mock('../src/helpers/save-message')

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  apiMock.reset()

  apiMock.resolves({})

  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test.each([
  { details: 'id undefined', message: { action: 'action' }, errorMessage: 'user.id must be a string' },
  { details: 'message undefined', id: 'id', errorMessage: 'message.action must be a string' },
  { details: 'message.action undefined', id: 'id', message: {}, errorMessage: 'message.action must be a string' }
])('.test it throws when $details', async ({ id, message, errorMessage }) => {
  await expect(sendMessage({ id }, message)).rejects.toThrow(errorMessage)
})

test('it saves message if no connectionId', async () => {
  await sendMessage({ id: 'id' }, { action: 'action' })

  expect(saveMessageModule.saveMessage).toHaveBeenCalledTimes(1)
  expect(saveMessageModule.saveMessage).toHaveBeenCalledWith({ id: 'id' }, { action: 'action' })
})

test('it posts to connection', async () => {
  apiMock.on(PostToConnectionCommand).resolves()

  await sendMessage({ id: 'id', connectionId: 'connectionId' }, { action: 'action' })

  expect(saveMessageModule.saveMessage).toHaveBeenCalledTimes(0)

  expect(apiMock).toHaveReceivedCommandWith(PostToConnectionCommand, {
    ConnectionId: 'connectionId',
    Data: JSON.stringify({ action: 'action' })
  })
})

test('it saves if error while posting to connection', async () => {
  apiMock.on(PostToConnectionCommand).rejects()

  await sendMessage({ id: 'id', connectionId: 'connectionId' }, { action: 'action' })

  expect(saveMessageModule.saveMessage).toHaveBeenCalledTimes(1)
  expect(saveMessageModule.saveMessage).toHaveBeenCalledWith({ id: 'id' }, { action: 'action' })
})
