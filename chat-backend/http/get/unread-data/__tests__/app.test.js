// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const getUserModule = require('chat-backend-package/src/get-user')
jest.mock('chat-backend-package/src/get-user', () => ({ getUser: jest.fn() }))

// ===== ==== ====
// TESTS
test('it reads unread data', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', unreadData: ['unread-data'] })
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } }
  })

  expect(JSON.stringify(response)).toBe(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id', unreadData: ['unread-data'] })
  }))
})

test('it returns default unread data', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id' })
  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } }
  })

  expect(JSON.stringify(response)).toBe(JSON.stringify({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: 'id', unreadData: [] })
  }))
})
