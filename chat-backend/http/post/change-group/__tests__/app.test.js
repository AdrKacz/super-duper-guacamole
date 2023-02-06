// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const getUserModule = require('chat-backend-package/src/get-user')
jest.mock('chat-backend-package/src/get-user', () => ({ getUser: jest.fn() }))

const leaveGroupModule = require('chat-backend-package/src/leave-group')
jest.mock('chat-backend-package/src/leave-group', () => ({ leaveGroup: jest.fn() }))

const findGroupModule = require('../src/find-group')
jest.mock('../src/find-group', () => ({ findGroup: jest.fn() }))

const createGroupModule = require('../src/create-group')
jest.mock('../src/create-group', () => ({ createGroup: jest.fn() }))

const joinGroupModule = require('../src/join-group')
jest.mock('../src/join-group', () => ({ joinGroup: jest.fn() }))

// ===== ==== ====
// TESTS
test('it throws error if leave group failed', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  leaveGroupModule.leaveGroup.mockRejectedValue(new Error('leave group rejected'))

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({})
  })

  expect(getUserModule.getUser).toHaveBeenCalledTimes(1)
  expect(getUserModule.getUser).toHaveBeenCalledWith({ id: 'id' })

  expect(leaveGroupModule.leaveGroup).toHaveBeenCalledTimes(1)
  expect(leaveGroupModule.leaveGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', groupId: 'group-id', blockedUserIds: new Set() } })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'leave group rejected' }))
})

test('it creates group if no group found', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })
  findGroupModule.findGroup.mockResolvedValue({})

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ city: 'city' })
  })

  expect(findGroupModule.findGroup).toHaveBeenCalledTimes(1)
  expect(findGroupModule.findGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', city: 'city', blockedUserIds: new Set() } })

  expect(createGroupModule.createGroup).toHaveBeenCalledTimes(1)
  expect(createGroupModule.createGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', city: 'city', blockedUserIds: new Set() } })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id' }))
})

test('it joins group if group found', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })
  findGroupModule.findGroup.mockResolvedValue({ group: { id: 'group-id' }, users: [{ id: 'id-1' }] })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ city: 'city' })
  })

  expect(joinGroupModule.joinGroup).toHaveBeenCalledTimes(1)
  expect(joinGroupModule.joinGroup).toHaveBeenCalledWith({ currentUser: { id: 'id', city: 'city', blockedUserIds: new Set() }, group: { id: 'group-id' }, users: [{ id: 'id-1' }] })

  expect(createGroupModule.createGroup).toHaveBeenCalledTimes(0)

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id' }))
})
