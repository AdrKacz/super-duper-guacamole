const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')
const { generateKeyPairSync, createSign } = require('crypto')

const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')

const { SNSClient } = require('@aws-sdk/client-sns')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

function generateIdentity (timestamp) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
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
  const id = '12345'
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
  const { id, signature, timestamp, publicKey } = generateIdentity(Date.now() - 5000)

  const response = await handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(response).toStrictEqual({ statusCode: 401 })
})
