// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const getUserModule = require('chat-backend-package/src/get-user')
jest.mock('chat-backend-package/src/get-user', () => ({ getUser: jest.fn() }))

const getGroupModule = require('chat-backend-package/src/get-group')
jest.mock('chat-backend-package/src/get-group', () => ({ getGroup: jest.fn() }))

const sendMessagesModule = require('chat-backend-package/src/send-messages')
jest.mock('chat-backend-package/src/send-messages', () => ({ sendMessages: jest.fn() }))

const sendNotificationsModule = require('chat-backend-package/src/send-notifications')
jest.mock('chat-backend-package/src/send-notifications', () => ({ sendNotifications: jest.fn() }))

const getUserDataModule = require('chat-backend-package/src/get-user-data')
jest.mock('chat-backend-package/src/get-user-data', () => ({ getUserData: jest.fn() }))

// ===== ==== ====
// TESTS
test('it rejects when no message', async () => {
  const response = await handler({
    body: JSON.stringify({})
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you didn\'t send a message' }))
})

test.each([
  { details: 'not JSON', message: 'message' },
  { details: 'JSON without text', message: JSON.stringify({ unvalid: 'unvalid' }) }
])('it rejects on invalid message ($details)', async ({ message }) => {
  getUserModule.getUser.mockResolvedValue({ id: 'id-1', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { id: 'group-id', isPublic: false }, users: [{ id: 'id-2' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id-1' } } } },
    body: JSON.stringify({ message })
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'your message is unvalid' }))
})

test('it rejects if user has no group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ message: JSON.stringify({ text: 'message  ' }) })
  })

  expect(getUserModule.getUser).toHaveBeenCalledTimes(1)
  expect(getUserModule.getUser).toHaveBeenCalledWith({ id: 'id' })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you don\'t have a group' }))
})

test('it rejects if user group is private', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id-1', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { id: 'group-id', isPublic: false }, users: [{ id: 'id-2' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id-1' } } } },
    body: JSON.stringify({ message: JSON.stringify({ text: 'message  ' }) })
  })

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id' })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you don\'t have a group yet' }))
})

test('it sends message to group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id-1', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { id: 'group-id', isPublic: true }, users: [{ id: 'id-2' }] })
  getUserDataModule.getUserData.mockResolvedValue({ name: 'name' })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id-1' } } } },
    body: JSON.stringify({ message: JSON.stringify({ text: '   message  ' }) })
  })

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({ users: [{ id: 'id-2' }], message: { action: 'text-message', message: JSON.stringify({ text: '   message  ' }) }, useSaveMessage: true })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'name a envoyé un message 🔥',
      body: 'message'
    }
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id-1', group: { id: 'group-id', isPublic: true }, message: JSON.stringify({ text: '   message  ' }) }))
})

test('it sends message to group with placeholder name if none', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id-1', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { id: 'group-id', isPublic: true }, users: [{ id: 'id-2' }] })
  getUserDataModule.getUserData.mockResolvedValue({})

  await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id-1' } } } },
    body: JSON.stringify({ message: JSON.stringify({ text: '   message  ' }) })
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'Quelqu\'un a envoyé un message 🔥',
      body: 'message'
    }
  })
})
