// ===== ==== ====
// IMPORTS
const { getUserData } = require('../get-user-data')
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
test('it returns user data if any', async () => {
  s3Mock.on(GetObjectCommand).resolves({
    Body: getSdkStream(JSON.stringify({
      name: 'name'
    }))
  })

  const response = await getUserData({ id: 'id' })

  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Key: 'users/id/data.json'
  })

  expect(response).toEqual({ name: 'name' })
})

test('it returns no data on error', async () => {
  s3Mock.on(GetObjectCommand).rejects()

  const response = await getUserData({ id: 'id' })

  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Key: 'users/id/data.json'
  })

  expect(response).toEqual({})
})
