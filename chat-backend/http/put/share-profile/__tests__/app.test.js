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

// ===== ==== ====
// TESTS
test('it rejects without a profile', async () => {
  await expect(handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({})
  })).rejects.toThrow('profile must be an object')
})

test('it returns if no group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ profile: ['profile'] })
  })

  expect(JSON.stringify(response)).toBe(JSON.stringify({
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'you don\'t have a group' })
  }))

  expect(getUserModule.getUser).toHaveBeenCalledWith({ id: 'id' })
  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(0)
})

test('it returns if group is not public', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { id: 'id', isPublic: false }, users: [{ id: 'id' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ profile: ['profile'] })
  })

  expect(JSON.stringify(response)).toBe(JSON.stringify({
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'you don\'t have a group yet' })
  }))
})

test('it sends message and notification to group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { id: 'id', isPublic: true }, users: [{ id: 'id' }, { id: 'id-2' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ profile: ['profile'] })
  })

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({
    users: [{ id: 'id' }, { id: 'id-2' }],
    message: {
      action: 'share-profile',
      user: 'id',
      profile: ['profile']
    },
    useSaveMessage: true
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id' }, { id: 'id-2' }],
    notification: {
      title: 'Les masques tombent 🎭',
      body: "Quelqu'un vient de révéler son identité"
    }
  })

  expect(JSON.stringify(response)).toBe(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'id' })
  }))
})
