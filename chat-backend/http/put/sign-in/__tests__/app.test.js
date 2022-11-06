// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const { mockClient } = require('aws-sdk-client-mock')

const crypto = require('node:crypto')
jest.mock('node:crypto', () => ({
  createVerify: jest.fn()
}))

const jwt = require('jsonwebtoken')
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}))

const {
  DynamoDBDocumentClient,
  GetCommand
} = require('@aws-sdk/lib-dynamodb')

Date.now = jest.fn()

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(DynamoDBDocumentClient)

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})
})

// ===== ==== ====
// TESTS
test.each([
  { details: 'wrong id type', id: 1, timestamp: 1, signature: 'signature' },
  { details: 'wrong timestamp type', id: 'id', timestamp: 'timestamp', signature: 'signature' },
  { details: 'wrong signature type', id: 'id', timestamp: 1 }
])('it rejects on $details', async ({ id, timestamp, signature }) => {
  const response = await handler({
    body: JSON.stringify({ id, timestamp, signature })
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'id, timestamp and signature must be defined with correct type' }))
})

test('it rejects on invalid timestamps', async () => {
  Date.now.mockReturnValue(3001)
  const response = await handler({
    body: JSON.stringify({ id: 'id', timestamp: 0, signature: 'signature' })
  })

  expect(response.statusCode).toBe(401)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'timestamp is not valid' }))
})

test('it rejects on banned user', async () => {
  Date.now.mockReturnValue(0)
  ddbMock.on(GetCommand).resolves({
    Item: {
      publicKey: 'public-key',
      isBanned: true
    }
  })
  const response = await handler({
    body: JSON.stringify({ id: 'id', timestamp: 0, signature: 'signature' })
  })

  expect(response.statusCode).toBe(403)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'you are banned' }))
})

test('it rejects on bad signature user', async () => {
  Date.now.mockReturnValue(0)

  ddbMock.on(GetCommand).resolves({
    Item: { publicKey: 'public-key' }
  })

  const verifier = {
    update: jest.fn().mockReturnThis(),
    verify: jest.fn().mockReturnValue(false)
  }
  crypto.createVerify.mockReturnValue(verifier)

  const response = await handler({
    body: JSON.stringify({ id: 'id', timestamp: 0, signature: 'signature' })
  })

  expect(crypto.createVerify).toHaveBeenCalledTimes(1)
  expect(crypto.createVerify).toHaveBeenCalledWith('rsa-sha256')
  expect(verifier.update).toHaveBeenCalledTimes(1)
  expect(verifier.update).toHaveBeenCalledWith('id0')
  expect(verifier.verify).toHaveBeenCalledTimes(1)
  expect(verifier.verify).toHaveBeenCalledWith('public-key', Buffer.from('signature'), 'base64')

  expect(response.statusCode).toBe(403)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ error: 'signature is not valid' }))
})

test('it returns jwt', async () => {
  Date.now.mockReturnValue(0)
  ddbMock.on(GetCommand).resolves({
    Item: { publicKey: 'public-key' }
  })

  const verifier = {
    update: jest.fn().mockReturnThis(),
    verify: jest.fn().mockReturnValue(true)
  }
  crypto.createVerify.mockReturnValue(verifier)
  jwt.sign.mockReturnValue('jwt-token')

  const response = await handler({
    body: JSON.stringify({ id: 'id', timestamp: 0, signature: 'signature' })
  })

  expect(jwt.sign).toHaveBeenCalledTimes(1)
  expect(jwt.sign).toHaveBeenCalledWith({ id: 'id' }, process.env.JWK_PRIVATE_KEY, {
    algorithm: 'RS256',
    keyid: process.env.AUTHENTICATION_STAGE,
    expiresIn: 15 * 60,
    notBefore: 0,
    audience: 'user',
    issuer: 'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/298-create-an-http-api-to-receive-command/chat-backend'
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ jwtToken: 'jwt-token' }))
})
