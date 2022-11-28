// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const { mockClient } = require('aws-sdk-client-mock')
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')
const ddbMock = mockClient(dynamoDBDocumentClient)

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const getGroupModule = require('chat-backend-package/src/get-group') // skipcq: JS-0260
jest.mock('chat-backend-package/src/get-group', () => ({
  getGroup: jest.fn()
}))

const getUserModule = require('chat-backend-package/src/get-user') // skipcq: JS-0260
jest.mock('chat-backend-package/src/get-user', () => ({
  getUser: jest.fn()
}))

// ===== ==== ====
// TESTS
test.each([
  { details: 'without group', id: 'id', expectedId: 'id', expectedGroup: null, expectedUsers: null },
  { details: 'with private group', id: 'id-1', group: { id: 'group-id', isPublic: false }, users: [{ id: 'id-2' }], expectedId: 'id-1', expectedGroup: { isPublic: false }, expectedUsers: null },
  { details: 'with public group', id: 'id-1', group: { id: 'group-id', isPublic: true }, users: [{ id: 'id-2' }], expectedId: 'id-1', expectedGroup: { id: 'group-id', isPublic: true }, expectedUsers: [{ id: 'id-2', isConnected: false }] }
])('it returns user status ($details)', async ({ id, group, users, expectedId, expectedGroup, expectedUsers }) => {
  getUserModule.getUser.mockResolvedValue({ id, groupId: group?.id })
  getGroupModule.getGroup.mockResolvedValue({ group, users })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id } } } }
  })

  expect(getUserModule.getUser).toHaveBeenCalledTimes(1)
  expect(getUserModule.getUser).toHaveBeenCalledWith({ id })

  if (typeof group === 'object') {
    expect(getGroupModule.getGroup).toHaveBeenCalledTimes(1)
    expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: group.id })
  } else {
    expect(getGroupModule.getGroup).toHaveBeenCalledTimes(0)
  }

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ id: expectedId, group: expectedGroup, users: expectedUsers }))
})

test('it updates group if not defined', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockRejectedValue(new Error('group (group-id) is not defined'))

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } }
  })

  expect(response.statusCode).toBe(200)

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    ConditionExpression: '#groupId = :groupId',
    UpdateExpression: 'REMOVE #groupId',
    ExpressionAttributeNames: { '#groupId': 'groupId' },
    ExpressionAttributeValues: { ':groupId': 'group-id' }
  })
})

test('it throws error', async () => {
  getUserModule.getUser.mockResolvedValue({ id: 'id', groupId: 'group-id' })
  getGroupModule.getGroup.mockRejectedValue(new Error('unknown error'))

  await expect(
    handler({ requestContext: { authorizer: { jwt: { claims: { id: 'id' } } } } })
  ).rejects.toThrow('unknown error')
})
