// ===== ==== ====
// IMPORTS
const { sendNotifications } = require('../send-notifications')

const firebaseClientsModule = require('../clients/firebase-clients')

// ===== ==== ====
// CONSTANTS
jest.mock('../clients/firebase-clients', () => ({
  messaging: {
    sendMulticast: jest.fn()
  }
}))

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test.each([
  { details: 'users undefined', title: 'title', body: 'body', errorMessage: 'users must be an array' },
  { details: 'notification.title undefined', users: [], body: 'body', errorMessage: 'notification.title and notification.body must be strings' },
  { details: 'notification.body undefined', users: [], title: 'title', errorMessage: 'notification.title and notification.body must be strings' }
])('.test it throws when $details', async ({ users, title, body, errorMessage }) => {
  await expect(sendNotifications({ users, notification: { title, body } })).rejects.toThrow(errorMessage)
})

test('it notifies users', async () => {
  firebaseClientsModule.messaging.sendMulticast.mockResolvedValue(Promise.resolve())

  await sendNotifications({ users: [{ firebaseToken: 'firebaseToken' }], notification: { title: 'title', body: 'body' } })

  expect(firebaseClientsModule.messaging.sendMulticast).toHaveBeenCalledTimes(1)
  expect(firebaseClientsModule.messaging.sendMulticast).toHaveBeenCalledWith({
    notification: { title: 'title', body: 'body' },
    tokens: ['firebaseToken']
  })
})
