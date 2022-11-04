// ===== ==== ====
// IMPORTS
jest.mock('../src/get-group', () => ({
  getGroup: 'get-group'
}))
jest.mock('../src/get-user', () => ({
  getUser: 'get-user'
}))
jest.mock('../src/send-messages', () => ({
  sendMessages: 'send-messages'
}))
jest.mock('../src/send-notifications', () => ({
  sendNotifications: 'send-notifications'
}))

const indexModule = require('../index')
// ===== ==== ====
// CONSTANTS
const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test('it has all dependencies', () => {
  expect(JSON.stringify(indexModule)).toBe(JSON.stringify({
    getGroup: 'get-group',
    getUser: 'get-user',
    sendMessages: 'send-messages',
    sendNotifications: 'send-notifications'
  }))
})
