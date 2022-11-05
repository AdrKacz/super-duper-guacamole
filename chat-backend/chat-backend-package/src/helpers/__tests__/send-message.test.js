// ===== ==== ====
// IMPORTS
const { sendMessage } = require('../send-message')
const { mockClient } = require('aws-sdk-client-mock')

const saveMessageModule = require('../save-message')
jest.mock('../save-message')

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} = require('@aws-sdk/client-apigatewaymanagementapi')

// ===== ==== ====
// CONSTANTS
const apiMock = mockClient(ApiGatewayManagementApiClient)

jest.spyOn(console, 'log')

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  apiMock.reset()

  apiMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it throws when id is undefined', async () => {
  await expect(sendMessage({
    user: {}, message: { action: 'action' }, useSaveMessage: true
  })).rejects.toThrow('user.id must be a string')
})

test('it throws when useSaveMessage is undefined', async () => {
  await expect(sendMessage({
    user: { id: 'id' }, message: { action: 'action' }
  })).rejects.toThrow('useSaveMessage must be a boolean')
})

test('it saves message if no connectionId', async () => {
  await sendMessage({ user: { id: 'id' }, message: { action: 'action' }, useSaveMessage: true })

  expect(saveMessageModule.saveMessage).toHaveBeenCalledTimes(1)
  expect(saveMessageModule.saveMessage).toHaveBeenCalledWith({ user: { id: 'id' }, message: { action: 'action' } })
})

test('it posts to connection', async () => {
  apiMock.on(PostToConnectionCommand).resolves()

  await sendMessage({ user: { id: 'id', connectionId: 'connectionId' }, message: { action: 'action' }, useSaveMessage: true })

  expect(saveMessageModule.saveMessage).toHaveBeenCalledTimes(0)

  expect(apiMock).toHaveReceivedCommandWith(PostToConnectionCommand, {
    ConnectionId: 'connectionId',
    Data: JSON.stringify({ action: 'action' })
  })
})

test('it saves if error while posting to connection', async () => {
  apiMock.on(PostToConnectionCommand).rejects()

  await sendMessage({ user: { id: 'id', connectionId: 'connectionId' }, message: { action: 'action' }, useSaveMessage: true })

  expect(saveMessageModule.saveMessage).toHaveBeenCalledTimes(1)
  expect(saveMessageModule.saveMessage).toHaveBeenCalledWith({ user: { id: 'id' }, message: { action: 'action' } })
})

test("it doesn't saves if not asked to", async () => {
  apiMock.on(PostToConnectionCommand).rejects()

  await sendMessage({ user: { id: 'id', connectionId: 'connectionId' }, message: { action: 'action' }, useSaveMessage: false })

  expect(saveMessageModule.saveMessage).toHaveBeenCalledTimes(0)
})
