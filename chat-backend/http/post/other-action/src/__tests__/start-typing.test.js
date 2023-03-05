// ===== ==== ====
// IMPORTS
const { startTyping } = require('../start-typing')

const sendNotificationsModule = require('chat-backend-package/src/send-notifications')
jest.mock('chat-backend-package/src/send-notifications', () => ({ sendNotifications: jest.fn() }))

const getUserDataModule = require('chat-backend-package/src/get-user-data')
jest.mock('chat-backend-package/src/get-user-data', () => ({ getUserData: jest.fn() }))

// ===== ==== ====
// TESTS
test('it sends notification with user name if any', async () => {
  getUserDataModule.getUserData.mockResolvedValue({ name: 'name' })

  await startTyping({ id: 'id', users: [{ id: 'id' }, { id: 'id-2' }] })

  expect(getUserDataModule.getUserData).toHaveBeenCalledTimes(1)
  expect(getUserDataModule.getUserData).toHaveBeenCalledWith({ id: 'id' })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'name est entrain d\'écrire...',
      body: 'Viens jeter un œil 👀'
    }
  })
})

test('it sends notification with placeholder name if no name', async () => {
  getUserDataModule.getUserData.mockResolvedValue({})

  await startTyping({ id: 'id', users: [{ id: 'id' }, { id: 'id-2' }] })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'Quelqu\'un est entrain d\'écrire...',
      body: 'Viens jeter un œil 👀'
    }
  })
})
