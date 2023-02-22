const { s3Client } = require('../s3-client')

// ===== ==== ====
// TESTS
test('it runs', () => {
  console.log(s3Client)
  expect(true)
})
