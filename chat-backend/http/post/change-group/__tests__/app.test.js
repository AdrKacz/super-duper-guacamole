// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const chatBackendPackageModule = require('chat-backend-package')
jest.mock('chat-backend-package', () => ({
  getUser: jest.fn()
}))

const findGroupModule = require('../src/find-group')
jest.mock('../src/find-group', () => ({
  findGroup: jest.fn()
}))

const leaveGroupModule = require('../src/leave-group')
jest.mock('../src/leave-group', () => ({
  leaveGroup: jest.fn()
}))

const createGroupModule = require('../src/create-group')
jest.mock('../src/create-group', () => ({
  createGroup: jest.fn()
}))

const joinGroupModule = require('../src/join-group')
jest.mock('../src/join-group', () => ({
  joinGroup: jest.fn()
}))

const createBubbleModule = require('../src/create-bubble')
jest.mock('../src/create-bubble', () => ({
  createBubble: jest.fn()
}))

// ===== ==== ====
// TESTS
test('it throws error if leave group failed', async () => {
  chatBackendPackageModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  leaveGroupModule.leaveGroup.mockRejectedValue(new Error('leave group rejected'))

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({})
  })

  expect(chatBackendPackageModule.getUser).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.getUser).toHaveBeenCalledWith({ id: 'id' })

  expect(leaveGroupModule.leaveGroup).toHaveBeenCalledTimes(1)
  expect(leaveGroupModule.leaveGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', groupId: 'group-id', blockedUserIds: new Set() } })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'leave group rejected' }))
})

test('it creates group if no group found', async () => {
  chatBackendPackageModule.getUser.mockResolvedValue({ id: 'id' })
  createBubbleModule.createBubble.mockReturnValue('bubble')
  findGroupModule.findGroup.mockResolvedValue({})

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ questions: { key: 'value' } })
  })

  expect(createBubbleModule.createBubble).toHaveBeenCalledTimes(1)
  expect(createBubbleModule.createBubble).toHaveBeenCalledWith({ key: 'value' })

  expect(findGroupModule.findGroup).toHaveBeenCalledTimes(1)
  expect(findGroupModule.findGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', bubble: 'bubble', blockedUserIds: new Set() } })

  expect(createGroupModule.createGroup).toHaveBeenCalledTimes(1)
  expect(createGroupModule.createGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', bubble: 'bubble', blockedUserIds: new Set() } })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id' }))
})

test('it joins group if group found', async () => {
  chatBackendPackageModule.getUser.mockResolvedValue({ id: 'id' })
  createBubbleModule.createBubble.mockReturnValue('bubble')
  findGroupModule.findGroup.mockResolvedValue({ group: { id: 'group-id' }, users: [{ id: 'id-1' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ questions: { key: 'value' } })
  })

  expect(joinGroupModule.joinGroup).toHaveBeenCalledTimes(1)
  expect(joinGroupModule.joinGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', bubble: 'bubble', blockedUserIds: new Set() }, group: { id: 'group-id' }, users: [{ id: 'id-1' }] })

  expect(createGroupModule.createGroup).toHaveBeenCalledTimes(0)

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id' }))
})
