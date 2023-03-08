// ===== ==== ====
// IMPORTS
const { createGroup } = require('../create-group')
const { mockClient } = require('aws-sdk-client-mock')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client')

const {
  UpdateCommand,
  PutCommand
} = require('@aws-sdk/lib-dynamodb')

const uuid = require('uuid')
jest.mock('uuid', () => ({
  v4: jest.fn()
}))

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(dynamoDBDocumentClient)

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})
})

// ===== ==== ====
// TESTS
test.each([
  { details: 'with blocked users', blockedUserIds: new Set(['blocked-id']), expectedBannedUserIds: new Set(['blocked-id']) },
  { details: 'without blocked users', blockedUserIds: new Set() }
])('it creates group and assign user ($details)', async ({ blockedUserIds, expectedBannedUserIds }) => {
  uuid.v4.mockReturnValue('uuidv4')

  await createGroup({ currentUser: { id: 'id', blockedUserIds, city: 'city' } })

  expect(ddbMock).toHaveReceivedCommandTimes(PutCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
    TableName: process.env.GROUPS_TABLE_NAME,
    Item: {
      id: 'uuidv4',
      isPublic: 'false',
      city: 'city',
      bannedUserIds: expectedBannedUserIds
    },
    ConditionExpression: 'attribute_not_exists(id)'
  })

  expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 1)
  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: 'SET #groupId = :groupId',
    ExpressionAttributeNames: { '#groupId': 'groupId' },
    ExpressionAttributeValues: { ':groupId': 'uuidv4' }
  })
})
