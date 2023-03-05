// ===== ==== ====
// IMPORTS
const { handler } = require('../app')
const { mockClient } = require('aws-sdk-client-mock')

const { s3Client } = require('chat-backend-package/src/clients/aws/s3-client')
const { PutObjectCommand } = require('@aws-sdk/client-s3')
const s3Mock = mockClient(s3Client)

const getUserModule = require('chat-backend-package/src/get-user')
jest.mock('chat-backend-package/src/get-user', () => ({ getUser: jest.fn() }))

const getGroupModule = require('chat-backend-package/src/get-group')
jest.mock('chat-backend-package/src/get-group', () => ({ getGroup: jest.fn() }))

const sendMessagesModule = require('chat-backend-package/src/send-messages')
jest.mock('chat-backend-package/src/send-messages', () => ({ sendMessages: jest.fn() }))

const sendNotificationsModule = require('chat-backend-package/src/send-notifications')
jest.mock('chat-backend-package/src/send-notifications', () => ({ sendNotifications: jest.fn() }))

Date.now = jest.fn()

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  s3Mock.reset()

  s3Mock.resolves({})
})

// ===== ==== ====
// TESTS
test('it returns if no image extension', async () => {
  const image = Buffer.from('image-file').toString('base64')

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ image })
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'You must provide a valid imageExtension' }))
})

test('it returns if unvalid image extension', async () => {
  const image = Buffer.from('image-file').toString('base64')

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ image, imageExtension: 'extension' })
  })

  expect(response.statusCode).toBe(400)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ error: 'You must provide a valid imageExtension' }))
})

test('it uploads and returns when no group', async () => {
  Date.now.mockReturnValue(0)
  getUserModule.getUser.mockResolvedValue({ id: 'id' })

  const image = Buffer.from('image-file').toString('base64')

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ name: 'name ', image, imageExtension: '.extension' })
  })

  expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Body: Buffer.from(image, 'base64'),
    Key: 'users/id/image.extension',
    ContentType: 'image/extension'
  })

  expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
    Bucket: process.env.DATA_BUCKET_NAME,
    Body: JSON.stringify({
      lastUpdate: 0,
      imagePath: 'users/id/image.extension',
      name: 'name'
    }),
    Key: 'users/id/data.json',
    ContentType: 'application/json'
  })

  expect(getUserModule.getUser).toHaveBeenCalledTimes(1)
  expect(getUserModule.getUser).toHaveBeenCalledWith({ id: 'id' })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id', message: 'you don\'t have a group to share with' }))
})

test('it uploads and returns when group but not opened', async () => {
  Date.now.mockReturnValue(0)
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { isPublic: false } })

  const image = Buffer.from('image-file').toString('base64')

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ image, imageExtension: '.extension' })
  })

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id' })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id', message: 'you don\'t have a group to share with' }))
})

test('it uploads and informs users when group', async () => {
  Date.now.mockReturnValue(0)
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockResolvedValue({ group: { isPublic: true }, users: [{ id: 'id' }, { id: 'id-2' }] })

  const image = Buffer.from('image-file').toString('base64')

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } },
    body: JSON.stringify({ image, imageExtension: '.extension' })
  })

  expect(sendMessagesModule.sendMessages).toHaveBeenCalledTimes(1)
  expect(sendMessagesModule.sendMessages).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    message: { action: 'update-status' },
    useSaveMessage: false
  })

  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledTimes(1)
  expect(sendNotificationsModule.sendNotifications).toHaveBeenCalledWith({
    users: [{ id: 'id-2' }],
    notification: {
      title: 'Changement d\'identité 🦹',
      body: 'Quelqu\'un a mis à jour son profil !'
    }
  })

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json; charset=utf-8' }))
  expect(response.body).toBe(JSON.stringify({ id: 'id' }))
})
