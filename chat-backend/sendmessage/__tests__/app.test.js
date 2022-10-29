// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

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
test('it throws error when users is undefined', async () => {
  await expect(handler({
    Records: [{
      Sns: {
        Message: JSON.stringify({})
      }
    }]
  })).rejects.toThrow('users and message must be defined')
})
