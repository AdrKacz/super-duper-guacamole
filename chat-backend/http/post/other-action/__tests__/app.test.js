// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')
const ddbMock = mockClient(dynamoDBDocumentClient)

const getGroupModule = require('chat-backend-package/src/get-group') // skipcq: JS-0260
jest.mock('chat-backend-package/src/get-group', () => ({
  getGroup: jest.fn()
}))

const getUserModule = require('chat-backend-package/src/get-user') // skipcq: JS-0260
jest.mock('chat-backend-package/src/get-user', () => ({
  getUser: jest.fn()
}))

const startTypingModule = require('../src/start-typing')
jest.mock('../src/start-typing', () => ({
  startTyping: jest.fn()
}))

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()
  ddbMock.resolves({})
})

// ===== ==== ====
// TESTS
test.each([
  { details: 'no action' },
  { details: 'unvalid action', action: 'unvalid' }
])('it returns if no valid actions ($details)', async ({ action }) => {
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ action })
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you didn\'t send a valid action' }))
})

test('it returns if cannot find group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ action: 'startTyping' })
  })

  expect(getUserModule.getUser).toHaveBeenCalledTimes(1)
  expect(getUserModule.getUser).toHaveBeenCalledWith({ id: 'id' })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you don\'t have a group' }))
})

test('it returns if no active group', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { isPublic: false } })
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ action: 'startTyping' })
  })

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id' })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you don\'t have a group yet' }))
})

test('it executes the correct action', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { isPublic: true }, users: [{ id: 'id' }, { id: 'id-2' }] })
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ action: 'startTyping' })
  })

  expect(startTypingModule.startTyping).toHaveBeenCalledTimes(1)
  expect(startTypingModule.startTyping).toHaveBeenCalledWith({ id: 'id', users: [{ id: 'id' }, { id: 'id-2' }] })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id' }))
})

test('it executes the no action without error if no implementation', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { isPublic: true }, users: [{ id: 'id' }, { id: 'id-2' }] })
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ action: 'stopTyping' })
  })

  expect(startTypingModule.startTyping).toHaveBeenCalledTimes(0)

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id' }))
})
