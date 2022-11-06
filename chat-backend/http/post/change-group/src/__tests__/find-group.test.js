// ===== ==== ====
// IMPORTS
const { findGroup } = require('../find-group')
const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')

const { QueryCommand } = require('@aws-sdk/lib-dynamodb')

const chatBackendPackageModule = require('chat-backend-package')
jest.mock('chat-backend-package', () => ({
  getGroup: jest.fn()
}))

const isGroupValidModule = require('../is-group-valid')
jest.mock('../is-group-valid', () => ({
  isGroupValid: jest.fn()
}))

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(dynamoDBDocumentClient)

const sort = jest.spyOn(Array.prototype, 'sort')

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it returns empty object if no group', async () => {
  ddbMock.on(QueryCommand).resolves({
    Count: 0,
    Items: []
  })

  const { group, users } = await findGroup({ currentUser: { bubble: 'bubble', groupId: 'group-id', blockedUserIds: new Set() } })

  expect(ddbMock).toHaveReceivedCommandTimes(QueryCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    IndexName: process.env.GROUPS_BUBBLE_INDEX_NAME,
    Limit: 10,
    KeyConditionExpression: '#bubble = :bubble AND groupSize < :five',
    ProjectionExpression: '#id',
    FilterExpression: '#id <> :oldGroupId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#bubble': 'bubble',
      '#groupSize': 'groupSize'
    },
    ExpressionAttributeValues: {
      ':bubble': 'bubble',
      ':five': 5,
      ':oldGroupId': 'group-id'
    }
  })

  expect(sort).toHaveBeenCalledTimes(0)
  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledTimes(0)

  expect(group).toBeUndefined()
  expect(users).toBeUndefined()
})

test('it returns valid group', async () => {
  ddbMock.on(QueryCommand).resolves({
    Count: 2,
    Items: [{ id: 'group-id-1' }, { id: 'group-id-2' }]
  })

  isGroupValidModule.isGroupValid.mockImplementation(({ group }) => {
    if (group.id === 'group-id-2') {
      return true
    } else {
      return false
    }
  })

  chatBackendPackageModule.getGroup.mockImplementation(({ groupId }) => ({
    group: { id: groupId },
    users: [{ id: 'id-1' }, { id: 'id-2' }]
  }))

  sort.mockReturnThis()

  const currentUser = { id: 'id', bubble: 'bubble', groupId: 'group-id', blockedUserIds: new Set() }
  const { group, users } = await findGroup({ currentUser })

  expect(sort).toHaveBeenCalledTimes(1)

  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledTimes(2)
  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id-1' })
  expect(chatBackendPackageModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id-2' })

  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledTimes(2)
  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledWith({ group: { id: 'group-id-1' }, users: [{ id: 'id-1' }, { id: 'id-2' }], currentUser })
  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledWith({ group: { id: 'group-id-2' }, users: [{ id: 'id-1' }, { id: 'id-2' }], currentUser })
  expect(isGroupValidModule.isGroupValid).toHaveLastReturnedWith(true)

  expect(JSON.stringify(group)).toBe(JSON.stringify({ id: 'group-id-2' }))
  expect(JSON.stringify(users)).toBe(JSON.stringify([{ id: 'id-1' }, { id: 'id-2' }]))
})

test('it returns empty object if no valid group', async () => {
  ddbMock.on(QueryCommand).resolves({
    Count: 2,
    Items: [{ id: 'group-id-1' }, { id: 'group-id-2' }]
  })

  isGroupValidModule.isGroupValid.mockReturnValue(false)

  chatBackendPackageModule.getGroup.mockImplementation(({ groupId }) => ({
    group: { id: groupId },
    users: [{ id: 'id-1' }, { id: 'id-2' }]
  }))

  sort.mockReturnThis()

  const currentUser = { id: 'id', bubble: 'bubble', groupId: 'group-id', blockedUserIds: new Set() }
  const { group, users } = await findGroup({ currentUser })

  expect(group).toBeUndefined()
  expect(users).toBeUndefined()
})
