const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')
const { generateKeyPairSync, createSign } = require('crypto')

const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient } = require('@aws-sdk/client-sns')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

function generatedKeyPair () {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })
}

function generateIdentity ({ id, timestamp } = {}) {
  const { privateKey, publicKey } = generatedKeyPair()

  if (typeof id !== 'string') {
    id = '12345'
  }

  if (typeof timestamp !== 'number') {
    timestamp = Date.now()
  }
  const signer = createSign('rsa-sha256')
  signer.update(id + timestamp.toString())
  const signature = signer.sign(privateKey, 'base64')

  return {
    privateKey,
    publicKey,
    id,
    timestamp,
    signature
  }
}

beforeEach(() => {
  ddbMock.reset()
  snsMock.reset()
})

test('it rejects empty body', async () => {
  const event = {
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({})
  }

  await expect(handler(event)).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')
})

test('it rejects body without id, signature, timestamp, and publicKey', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  // no id
  await expect(handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ signature, timestamp, publicKey })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')

  // no signature
  await expect(handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, timestamp, publicKey })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')

  // no timestamp
  await expect(handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, publicKey })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')

  // no public key
  await expect(handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, timestamp })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')
})

test('it rejects body with old timestamp', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity({ timestamp: Date.now() - 5000 })

  const response = await handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(response).toStrictEqual({
    message: 'timestamp is not valid',
    statusCode: 401
  })
})

test('it rejects on wrong signature', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  ddbMock.on(GetCommand, {
    Key: { id }
  }).resolves({
    Item: {
      id,
      publicKey: generatedKeyPair().publicKey
    }
  })

  const response = await handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(response).toStrictEqual({
    message: 'signature is not valid',
    statusCode: 401
  })
})

test('it register new user', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  ddbMock.on(GetCommand, {
    Key: { id }
  }).resolves({})

  const response = await handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })
  console.log(response)

  const ddbMockUpdateCalls = ddbMock.commandCalls(UpdateCommand)

  console.log(ddbMockUpdateCalls)
  expect(ddbMockUpdateCalls).toHaveLength(1)
})
