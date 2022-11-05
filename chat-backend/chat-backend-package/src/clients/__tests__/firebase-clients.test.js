// ===== ==== ====
// IMPORTS
const firebaseClientsModule = require('../firebase-clients')

// ===== ==== ====
// CONSTANTS
jest.mock('firebase-admin/app')
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: (_) => ('messaging')
}))

// ===== ==== ====
// TESTS
test('it has messaging', () => {
  expect(JSON.stringify(firebaseClientsModule)).toStrictEqual(JSON.stringify({
    messaging: 'messaging'
  }))
})
