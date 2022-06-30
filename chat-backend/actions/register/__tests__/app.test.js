// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')
const { generateKeyPairSync, createSign } = require('crypto')

const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

// ===== ==== ====
// HELPERS
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

function sign (message = '', privateKey) {
  const signer = createSign('rsa-sha256')

  signer.update(message)

  return signer.sign(privateKey)
}

function generateIdentity ({ id, timestamp } = {}) {
  const { privateKey, publicKey } = generatedKeyPair()

  if (typeof id !== 'string') {
    id = '12345'
  }

  if (typeof timestamp !== 'number') {
    timestamp = Date.now()
  }

  const signature = sign(id + timestamp.toString(), privateKey)

  return {
    privateKey,
    publicKey,
    id,
    timestamp,
    signature
  }
}

// ===== ==== ====
// BEFORE
beforeEach(() => {
  ddbMock.reset()
  snsMock.reset()

  ddbMock.resolves({})
  snsMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it reads environment variables', async () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.GROUPS_TABLE_NAME).toBeDefined()
  expect(process.env.SEND_MESSAGE_TOPIC_ARN).toBeDefined()
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

  await handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(GetCommand, 1)
  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 1)
  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
})

test('it sends message with unreadData', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  const dummyUnreadData = ['dummy-data-01', 'dummy-data-02']

  ddbMock.on(UpdateCommand, {
    Key: { id }
  }).resolves({
    Attributes: {
      id,
      unreadData: dummyUnreadData
    }
  })

  await handler({
    requestContext: {
      connectionId: '012345678'
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(snsMock).toHaveReceivedNthCommandWith(1, PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{
        id, connectionId: '012345678'
      }],
      message: {
        action: 'register',
        unreadData: dummyUnreadData
      }
    })
  })
})
