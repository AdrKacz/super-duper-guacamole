// ===== ==== ====
// IMPORTS
const { startTyping } = require('../start-typing')
const { mockClient } = require('aws-sdk-client-mock')

const { Readable } = require('stream')
const { sdkStreamMixin } = require('@aws-sdk/util-stream-node')
const { s3Client } = require('chat-backend-package/src/clients/aws/s3-client')
const { GetObjectCommand } = require('@aws-sdk/client-s3')
const s3Mock = mockClient(s3Client)

const sendNotificationsModule = require('chat-backend-package/src/send-notifications')
jest.mock('chat-backend-package/src/send-notifications', () => ({ sendNotifications: jest.fn() }))

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
test('it sends notification with user name if any', async () => {
  s3Mock.on(GetObjectCommand).resolves({
    Body: getSdkStream(JSON.stringify({
      name: 'name'
    }))
  })

  await startTyping({ id: 'id', users: [{ id: 'id' }, { id: 'id-2' }] })

  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Key: 'users/id/data.json'
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'name est entrain d\'écrire...',
      body: 'Viens jeter un œil 👀'
    }
  })
})

test('it sends notification with placeholder name if no name', async () => {
  s3Mock.on(GetObjectCommand).resolves({
    Body: getSdkStream(JSON.stringify({
    }))
  })

  await startTyping({ id: 'id', users: [{ id: 'id' }, { id: 'id-2' }] })

  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Key: 'users/id/data.json'
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'Quelqu\'un est entrain d\'écrire...',
      body: 'Viens jeter un œil 👀'
    }
  })
})

test('it sends notification with placeholder name if error', async () => {
  s3Mock.on(GetObjectCommand).rejects()

  await startTyping({ id: 'id', users: [{ id: 'id' }, { id: 'id-2' }] })

  expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Key: 'users/id/data.json'
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'Quelqu\'un est entrain d\'écrire...',
      body: 'Viens jeter un œil 👀'
    }
  })
})
