const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')
const { generateKeyPairSync, createSign } = require('crypto')

const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')

const { SNSClient } = require('@aws-sdk/client-sns')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

function generateIdentity () {
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
  const timestamp = Date.now()
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

test('it rejects body without id', async () => {
  const { signature, timestamp } = generateIdentity()
  const event = {
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ signature, timestamp })
  }

  await expect(handler(event)).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')
})

test('it rejects body without signature', async () => {
  const { id, timestamp } = generateIdentity()
  const event = {
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, timestamp })
  }

  await expect(handler(event)).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')
})

test('it rejects body without timestamp', async () => {
  const { id, signature } = generateIdentity()
  const event = {
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature })
  }

  await expect(handler(event)).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')
})
