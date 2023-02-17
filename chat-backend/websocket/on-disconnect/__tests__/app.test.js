// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const disconnectUserModule = require('chat-backend-package/src/disconnect-user')
jest.mock('chat-backend-package/src/disconnect-user', () => ({ disconnectUser: jest.fn() }))

// ===== ==== ====
// TESTS
test('it calls disconnect user', async () => {
  await handler({
    requestContext: {
      connectionId: 'connection-id',
      authorizer: { id: 'id' }
    }
  })

  expect(disconnectUserModule.disconnectUser).toHaveBeenCalledWith({ id: 'id', connectionId: 'connection-id' })
})
