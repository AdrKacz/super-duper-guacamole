// ===== ==== ====
// IMPORTS
const { sendNotification } = require('../src/send-notification')

const firebaseClientsModule = require('../src/clients/firebase-clients')

// ===== ==== ====
// CONSTANTS
jest.mock('../src/clients/firebase-clients', () => ({
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
  await expect(sendNotification(users, { title, body })).rejects.toThrow(errorMessage)
})

test('it notifies users', async () => {
  firebaseClientsModule.messaging.sendMulticast.mockResolvedValue(Promise.resolve())

  await sendNotification([{ firebaseToken: 'firebaseToken' }], { title: 'title', body: 'body' })

  expect(firebaseClientsModule.messaging.sendMulticast).toHaveBeenCalledTimes(1)
  expect(firebaseClientsModule.messaging.sendMulticast).toHaveBeenCalledWith({
    notification: { title: 'title', body: 'body' },
    tokens: ['firebaseToken']
  })
})
