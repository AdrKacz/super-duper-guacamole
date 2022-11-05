// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const chatBackendPackageModule = require('chat-backend-package')
jest.mock('chat-backend-package', () => ({
  getUser: jest.fn(),
  getGroup: jest.fn(),
  sendMessages: jest.fn(),
  sendNotifications: jest.fn()
}))

// ===== ==== ====
// TESTS
test('it rejects when no message', async () => {
  const response = await handler({
    body: JSON.stringify({})
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you didn\'t send a message' }))
})

test('it rejects if user has no group', async () => {
  chatBackendPackageModule.getUser.mockResolvedValue({ id: 'id' })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ message: 'message' })
  })

  expect(chatBackendPackageModule.getUser).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.getUser).toHaveBeenCalledWith({ id: 'id' })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you don\'t have a group' }))
})

test('it rejects if user group is private', async () => {
  chatBackendPackageModule.getUser.mockResolvedValue({ id: 'id-1', groupId: 'group-id' })
  chatBackendPackageModule.getGroup.mockResolvedValue({ group: { id: 'group-id', isPublic: false }, users: [{ id: 'id-2' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id-1' } } } },
    body: JSON.stringify({ message: 'message' })
  })

  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id' })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you don\'t have a group yet' }))
})

test('it sends message to group', async () => {
  chatBackendPackageModule.getUser.mockResolvedValue({ id: 'id-1', groupId: 'group-id' })
  chatBackendPackageModule.getGroup.mockResolvedValue({ group: { id: 'group-id', isPublic: true }, users: [{ id: 'id-2' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id-1' } } } },
    body: JSON.stringify({ message: 'message' })
  })

  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendMessages).toHaveBeenCalledWith({ users: [{ id: 'id-2' }], message: 'message', useSaveMessage: true })

  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'Les gens parlent 🎉',
      body: 'Tu es trop loin pour entendre ...'
    }
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id-1', group: { id: 'group-id', isPublic: true }, message: 'message' }))
})
