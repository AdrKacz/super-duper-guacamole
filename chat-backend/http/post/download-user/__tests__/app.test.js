// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')

const { Readable } = require('stream')
const { sdkStreamMixin } = require('@aws-sdk/util-stream-node')
const { s3Client } = require('chat-backend-package/src/clients/aws/s3-client')
const { GetObjectCommand } = require('@aws-sdk/client-s3')
const s3Mock = mockClient(s3Client)

// ===== ==== ====
// HELPERS
function getSdkStream (str) {
  const stream = new Readable()
  stream.push(str)
  stream.push(null)
  return sdkStreamMixin(stream)
}

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  s3Mock.reset()
  s3Mock.resolves({})
})

// ===== ==== ====
// TESTS
test('it returns if no user data', async () => {
  s3Mock.on(GetObjectCommand).rejects()

  const response = await handler({
    body: JSON.stringify({
      id: 'id'
    })
  })

  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Key: 'users/id/data.json'
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id', message: 'You already have the latest version' }))
})

test('it returns if already last update', async () => {
  s3Mock.on(GetObjectCommand).resolves({
    Body: getSdkStream(JSON.stringify({
      lastUpdate: 0
    }))
  })

  const response = await handler({
    body: JSON.stringify({
      id: 'id',
      lastUpdate: 0
    })
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id', message: 'You already have the latest version' }))
})

test('it returns data and image', async () => {
  s3Mock.on(GetObjectCommand, {
    Key: 'users/id/data.json'
  }).resolves({
    Body: getSdkStream(JSON.stringify({
      lastUpdate: 1,
      imagePath: 'image-path'
    }))
  })

  s3Mock.on(GetObjectCommand, {
    Key: 'image-path'
  }).resolves({
    Body: getSdkStream('image-file')
  })

  const response = await handler({
    body: JSON.stringify({
      id: 'id',
      lastUpdate: 0
    })
  })

  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Key: 'image-path'
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({
    id: 'id',
    data: {
      lastUpdate: 1,
      imagePath: 'image-path'
    },
    image: Buffer.from('image-file').toString('base64')
  }))
})

test('it doesn\'t send image if none', async () => {
  s3Mock.on(GetObjectCommand, {
    Key: 'users/id/data.json'
  }).resolves({
    Body: getSdkStream(JSON.stringify({
      lastUpdate: 1,
      imagePath: 'image-path'
    }))
  })

  s3Mock.on(GetObjectCommand, {
    Key: 'image-path'
  }).rejects()

  const response = await handler({
    body: JSON.stringify({
      id: 'id',
      lastUpdate: 0
    })
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({
    id: 'id',
    data: {
      lastUpdate: 1,
      imagePath: 'image-path'
    },
    image: null
  }))
})
