// ===== ==== ====
// IMPORTS
const firebaseClientsModule = require('../src/clients/firebase-clients')

// ===== ==== ====
// CONSTANTS
jest.mock('firebase-admin/app')
jest.mock('firebase-admin/messaging')

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test('it has messaging', () => {
  expect(JSON.stringify(firebaseClientsModule)).toStrictEqual(JSON.stringify({
    messaging: undefined
  }))
})
