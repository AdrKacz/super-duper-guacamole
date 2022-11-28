// ===== ==== ====
// IMPORTS
process.env.AUTHENTICATION_STAGE = 'key-0'
const { handler } = require('../app')

const verify = require('jsonwebtoken/verify')
jest.mock('jsonwebtoken/verify', () => (jest.fn()))

const jwkToPem = require('jwk-to-pem')
jest.mock('jwk-to-pem', () => (jest.fn()))

const axios = require('axios')
jest.mock('axios', () => ({ get: jest.fn() }))
// ===== ==== ====
// TESTS
test('it verifies', async () => {
  axios.get.mockResolvedValue({ data: { keys: [{ kid: 'key-0' }] } })

  jwkToPem.mockReturnValue('pem')

  verify.mockReturnValue({ id: 'id' })

  const callback = jest.fn()
  await handler({
    queryStringParameters: { token: 'token' },
    methodArn: 'method-arn'
  }, null, callback)

  expect(axios.get).toHaveBeenCalledWith('https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/chat-backend/.well-known/jwks.json')
  expect(jwkToPem).toHaveBeenCalledWith({ kid: 'key-0' })
  expect(verify).toHaveBeenCalledWith('token', 'pem', {
    issuer: 'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/chat-backend',
    audience: 'user'
  })
  expect(callback).toHaveBeenCalledWith(null, {
    principalId: 'id',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: 'Allow',
        Resource: 'method-arn'
      }]
    },
    context: { id: 'id' }
  })
})

test('it throws if no key', async () => {
  axios.get.mockResolvedValue({ data: { keys: [{ kid: 'key-1' }] } })

  jwkToPem.mockReturnValue('pem')

  verify.mockReturnValue({ id: 'id' })

  const callback = jest.fn()
  await handler({
    queryStringParameters: { token: 'token' },
    methodArn: 'method-arn'
  }, null, callback)

  expect(axios.get).toHaveBeenCalledTimes(1)
  expect(jwkToPem).toHaveBeenCalledTimes(0)
  expect(verify).toHaveBeenCalledTimes(0)
  expect(callback).toHaveBeenCalledWith(new Error('Unauthorized'))
})
