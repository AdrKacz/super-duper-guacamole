// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const getUserFromConnectionIdModule = require('../src/get-user-from-connection-id')
const sendMessageToGroupModule = require('../src/send-message-to-group')

// ===== ==== ====
// CONSTANTS
jest.mock('../src/get-user-from-connection-id')
jest.mock('../src/send-message-to-group')

jest.spyOn(console, 'log')

// ===== ==== ====
// TESTS
test.each([
  { details: 'it rejects on undefined user id', groupId: 'group-id', message: 'message', errorMessage: 'user or group cannot be found' },
  { details: 'it rejects on undefined group id', id: 'id', message: 'message', errorMessage: 'user or group cannot be found' },
  { details: 'it rejects on undefined message', id: 'id', groupId: 'group-id', errorMessage: 'message must be defined' }
])('.test $details', async ({ id, groupId, message, errorMessage }) => {
  const connectionId = 'connectionId'
  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))

  await expect(handler({
    requestContext: { connectionId },
    body: JSON.stringify({ message })
  })).rejects.toThrow(errorMessage)

  expect(getUserFromConnectionIdModule.getUserFromConnectionId).toHaveBeenCalledTimes(1)
  expect(getUserFromConnectionIdModule.getUserFromConnectionId).toHaveBeenCalledWith(connectionId)
})

test('it sends message', async () => {
  const id = 'id'
  const groupId = 'group-id'
  const connectionId = 'connectionId'
  const message = 'message'

  getUserFromConnectionIdModule.getUserFromConnectionId.mockResolvedValue(Promise.resolve({ id, groupId }))
  sendMessageToGroupModule.sendMessageToGroup.mockResolvedValue(Promise.resolve())

  const response = await handler({
    requestContext: { connectionId },
    body: JSON.stringify({ message })
  })

  expect(response).toEqual({ statusCode: 200 })

  expect(sendMessageToGroupModule.sendMessageToGroup).toHaveBeenCalledTimes(1)
  expect(sendMessageToGroupModule.sendMessageToGroup).toHaveBeenCalledWith({
    groupId,
    message: {
      action: 'textmessage',
      message
    },
    notification: {
      title: 'Les gens parlent 🎉',
      body: 'Tu es trop loin pour entendre ...'
    },
    fetchedUsers: [{ id, groupId, connectionId }]
  })
})
