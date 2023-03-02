// ===== ==== ====
// IMPORTS
const { findGroup } = require('../find-group')
const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')

const { QueryCommand } = require('@aws-sdk/lib-dynamodb')

const getGroupModule = require('chat-backend-package/src/get-group') // skipcq: JS-0260
jest.mock('chat-backend-package/src/get-group', () => ({
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

  const { group, users } = await findGroup({ currentUser: { city: 'city', groupId: 'group-id', blockedUserIds: new Set() } })

  expect(ddbMock).toHaveReceivedCommandTimes(QueryCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    IndexName: process.env.GROUPS_CITY_INDEX_NAME,
    Limit: 10,
    KeyConditionExpression: '#city = :city AND #groupSize < :maximumGroupSize',
    ProjectionExpression: '#id',
    FilterExpression: '#id <> :oldGroupId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#city': 'city',
      '#groupSize': 'groupSize'
    },
    ExpressionAttributeValues: {
      ':city': 'city',
      ':maximumGroupSize': parseInt(process.env.MAXIMUM_GROUP_SIZE, 10),
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
    Items: [{ id: 'group-id-1' }, { id: 'group-id-2' }, { id: 'group-id-3' }]
  })

  isGroupValidModule.isGroupValid.mockImplementation(({ group }) => {
    if (group.id === 'group-id-3') {
      return true
    } else if (group.id === 'group-id-2') {
      throw new Error('unknown-error')
    }

    return false
  })

  getGroupModule.getGroup.mockImplementation(({ groupId }) => ({
    group: { id: groupId },
    users: [{ id: 'id-1' }, { id: 'id-2' }]
  }))

  sort.mockReturnThis()

  const currentUser = { id: 'id', city: 'city', groupId: 'group-id', blockedUserIds: new Set() }
  const { group, users } = await findGroup({ currentUser })

  expect(sort).toHaveBeenCalledTimes(1)

  expect(getGroupModule.getGroup).toHaveBeenCalledTimes(3)
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id-1' })
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id-2' })
  expect(getGroupModule.getGroup).toHaveBeenCalledWith({ groupId: 'group-id-3' })

  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledTimes(3)
  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledWith({ group: { id: 'group-id-1' }, users: [{ id: 'id-1' }, { id: 'id-2' }], currentUser })
  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledWith({ group: { id: 'group-id-2' }, users: [{ id: 'id-1' }, { id: 'id-2' }], currentUser })
  expect(isGroupValidModule.isGroupValid).toHaveBeenCalledWith({ group: { id: 'group-id-3' }, users: [{ id: 'id-1' }, { id: 'id-2' }], currentUser })
  expect(isGroupValidModule.isGroupValid).toHaveLastReturnedWith(true)

  expect(JSON.stringify(group)).toBe(JSON.stringify({ id: 'group-id-3' }))
  expect(JSON.stringify(users)).toBe(JSON.stringify([{ id: 'id-1' }, { id: 'id-2' }]))
})

test('it returns empty object if no valid group', async () => {
  ddbMock.on(QueryCommand).resolves({
    Count: 2,
    Items: [{ id: 'group-id-1' }, { id: 'group-id-2' }]
  })

  isGroupValidModule.isGroupValid.mockReturnValue(false)

  getGroupModule.getGroup.mockImplementation(({ groupId }) => ({
    group: { id: groupId },
    users: [{ id: 'id-1' }, { id: 'id-2' }]
  }))

  sort.mockReturnThis()

  const currentUser = { id: 'id', city: 'city', blockedUserIds: new Set() }
  const { group, users } = await findGroup({ currentUser })

  expect(ddbMock).toHaveReceivedCommandTimes(QueryCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    IndexName: process.env.GROUPS_CITY_INDEX_NAME,
    Limit: 10,
    KeyConditionExpression: '#city = :city AND #groupSize < :maximumGroupSize',
    ProjectionExpression: '#id',
    FilterExpression: '#id <> :oldGroupId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#city': 'city',
      '#groupSize': 'groupSize'
    },
    ExpressionAttributeValues: {
      ':city': 'city',
      ':maximumGroupSize': parseInt(process.env.MAXIMUM_GROUP_SIZE, 10),
      ':oldGroupId': ''
    }
  })

  expect(group).toBeUndefined()
  expect(users).toBeUndefined()
})
