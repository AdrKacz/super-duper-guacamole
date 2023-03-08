// ===== ==== ====
// IMPORTS
const indexModule = require('../index')

// ===== ==== ====
// TESTS
test('it has all dependencies', () => {
  expect(JSON.stringify(indexModule)).toBe(JSON.stringify({
    CONSTANTS: {
      TRUE: 'true',
      FALSE: 'false'
    }
  }))
})
