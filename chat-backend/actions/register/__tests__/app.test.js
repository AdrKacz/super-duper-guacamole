// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')
const { generateKeyPairSync, createSign } = require('crypto')

// ===== ==== ====
// CONSTANTS
const {
  DynamoDBDocumentClient,
  GetCommand, UpdateCommand,
  BatchGetCommand
} = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

jest.spyOn(console, 'log')

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

function sign (privateKey, message = '') {
  const signer = createSign('rsa-sha256')

  signer.update(message)

  return signer.sign(privateKey)
}

function generateIdentity ({ id, timestamp } = {}) {
  const { privateKey, publicKey } = generatedKeyPair()

  const usedId = typeof id === 'string' ? id : '12345'
  const usedTimestamp = typeof timestamp === 'number' ? timestamp : Date.now()

  const signature = sign(privateKey, usedId + usedTimestamp.toString())
  return {
    privateKey,
    publicKey,
    id: usedId,
    timestamp: usedTimestamp,
    signature
  }
}

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  ddbMock.reset()
  snsMock.reset()

  ddbMock.resolves({})
  snsMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it reads environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.GROUPS_TABLE_NAME).toBeDefined()
  expect(process.env.SEND_MESSAGE_TOPIC_ARN).toBeDefined()
})

test('it rejects empty body', async () => {
  const dummyConnectionId = 'dummy-connection-id'
  await expect(handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({})
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')
})

test('it rejects body without id, signature, timestamp, and publicKey', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()
  const dummyConnectionId = 'dummy-connection-id'
  // no id
  await expect(handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ signature, timestamp, publicKey })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')

  // no signature
  await expect(handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, timestamp, publicKey })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')

  // no timestamp
  await expect(handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, publicKey })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')

  // no public key
  await expect(handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp })
  })).rejects.toThrow('id, signature, timestamp, and publicKey must be defined')
})

test('it rejects body with old timestamp', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity({ timestamp: Date.now() - 5000 })

  const dummyConnectionId = 'dummy-connection-id'
  const response = await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(response).toStrictEqual({
    message: 'timestamp is not valid',
    statusCode: 401
  })
})

test('it rejects on banned user', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  ddbMock.on(GetCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Item: {
      id,
      publicKey: generatedKeyPair().publicKey,
      isBanned: true
    }
  })

  const dummyConnectionId = 'dummy-connection-id'
  const response = await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(response).toStrictEqual({
    message: 'user is banned',
    statusCode: 403
  })
})

test('it rejects on wrong signature', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  ddbMock.on(GetCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Item: {
      id,
      publicKey: generatedKeyPair().publicKey
    }
  })

  const dummyConnectionId = 'dummy-connection-id'
  const response = await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(response).toStrictEqual({
    message: 'signature is not valid',
    statusCode: 403
  })
})

test('it registers new user', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  const dummyConnectionId = 'dummy-connection-id'

  await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(GetCommand, 1)
  expect(ddbMock).toHaveReceivedNthCommandWith(2, UpdateCommand, {
    ReturnValues: 'ALL_OLD',
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id },
    UpdateExpression: `
    SET #isInactive = :false, #connectionId = :connectionId, #publicKey = :publicKey
    REMOVE #unreadData
    `,
    ExpressionAttributeNames: {
      '#isInactive': 'isInactive',
      '#connectionId': 'connectionId',
      '#publicKey': 'publicKey',
      '#unreadData': 'unreadData'
    },
    ExpressionAttributeValues: {
      ':connectionId': dummyConnectionId,
      ':publicKey': publicKey,
      ':false': false
    }
  })

  expect(snsMock).toHaveReceivedNthCommandWith(1, PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{
        id, connectionId: dummyConnectionId
      }],
      message: {
        action: 'register',
        unreadData: []
      }
    })
  })
})

test('it sends message with unreadData', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  const dummyUnreadData = ['dummy-data-01', 'dummy-data-02']

  ddbMock.on(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Attributes: {
      id,
      unreadData: dummyUnreadData
    }
  })

  const dummyConnectionId = 'dummy-connection-id'
  await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(snsMock).toHaveReceivedNthCommandWith(1, PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{
        id, connectionId: dummyConnectionId
      }],
      message: {
        action: 'register',
        unreadData: dummyUnreadData
      }
    })
  })
})

test('it sends login to group users', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()
  const dummyGroupId = 'dummy-group-id'

  ddbMock.on(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Attributes: {
      id,
      groupId: dummyGroupId
    }
  })

  const dummyOtherGroupUsers = [
    { id: 'dummy-user-id-01', connectionId: 'dummy-connection-01' },
    { id: 'dummy-user-id-02', connectionId: 'dummy-connection-02' }
  ]

  ddbMock.on(GetCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: dummyGroupId }
  }).resolves({
    Item: {
      id,
      users: new Set(dummyOtherGroupUsers.map(({ id }) => (id)))
    }
  })

  ddbMock.on(BatchGetCommand, {

  }).resolves({
    Responses: {
      [process.env.USERS_TABLE_NAME]: dummyOtherGroupUsers
    }
  })

  const dummyConnectionId = 'dummy-connection-id'
  await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(snsMock).toHaveReceivedNthCommandWith(1, PublishCommand, {
    TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: dummyOtherGroupUsers,
      message: {
        action: 'login',
        id
      }
    })
  })
})

test('it stops on group not found', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()
  const dummyGroupId = 'dummy-group-id'

  ddbMock.on(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Attributes: {
      id,
      groupId: dummyGroupId
    }
  })

  const dummyConnectionId = 'dummy-connection-id'

  await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 0)
  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
})

test('it stops on undefined group', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()

  ddbMock.on(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Attributes: {
      id
    }
  })

  const dummyConnectionId = 'dummy-connection-id'

  await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 0)
  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
})

test('it pass on unknown error on get command group', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()
  const dummyGroupId = 'dummy-group-id'

  ddbMock.on(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Attributes: {
      id,
      groupId: dummyGroupId
    }
  })

  ddbMock.on(GetCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: dummyGroupId }
  }).rejects('unknown error')

  const dummyConnectionId = 'dummy-connection-id'

  await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 0)
  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
})

test('it pass if no other user in group', async () => {
  const { id, signature, timestamp, publicKey } = generateIdentity()
  const dummyGroupId = 'dummy-group-id'

  ddbMock.on(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id }
  }).resolves({
    Attributes: {
      id,
      groupId: dummyGroupId
    }
  })

  ddbMock.on(GetCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Key: { id: dummyGroupId }
  }).resolves({
    Item: {
      id,
      users: []
    }
  })

  const dummyConnectionId = 'dummy-connection-id'

  await handler({
    requestContext: {
      connectionId: dummyConnectionId
    },
    body: JSON.stringify({ id, signature, timestamp, publicKey })
  })

  expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 0)
  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 1)
})
