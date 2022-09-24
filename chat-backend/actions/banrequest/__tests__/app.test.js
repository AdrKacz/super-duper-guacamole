// ===== ==== ====
// IMPORTS
const {
  handler,
  getBannedUserAndGroup,
  getUserFromConnectionId
} = require('../app')
const { mockClient } = require('aws-sdk-client-mock')

// ===== ==== ====
// CONSTANTS
const {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand
} = require('@aws-sdk/lib-dynamodb')

const { SNSClient } = require('@aws-sdk/client-sns')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

const dummyConnectionId = 'dummy-connection-id'
const dummyUserId = 'dummy-user-id'
const dummyBannedId = 'dummy-banned-id'
const dummyGroupId = 'dummy-group-id'

const log = jest.spyOn(console, 'log').mockImplementation(() => {})

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // set up special env variable
  process.env.CONFIRMATION_REQUIRED_STRING = '3'
  // reset mocks
  ddbMock.reset()
  snsMock.reset()

  ddbMock.resolves({})
  snsMock.resolves({})

  // reset console
  log.mockReset()
})

// ===== ==== ====
// TESTS

test('it reads environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.USERS_CONNECTION_ID_INDEX_NAME).toBeDefined()
  expect(process.env.GROUPS_TABLE_NAME).toBeDefined()
  expect(process.env.CONFIRMATION_REQUIRED_STRING).toBeDefined()
  expect(process.env.SEND_MESSAGE_TOPIC_ARN).toBeDefined()
  expect(process.env.SEND_NOTIFICATION_TOPIC_ARN).toBeDefined()
  expect(process.env.AWS_REGION).toBeDefined()
})

describe('getUserFromConnectionId', () => {
  test.each([
    { details: 'it returns an empty object if no user found', items: [], expected: {} },
    { details: 'it returns an empty object if user has no id', items: [{}], expected: {} },
    { details: 'it returns the first associated user', items: [{ id: dummyUserId }, { id: `${dummyUserId}-2` }], expected: { id: dummyUserId, groupId: undefined } },
    { details: 'it returns user with group attribute if groupId attribute is not defined', items: [{ id: dummyUserId, group: dummyGroupId }], expected: { id: dummyUserId, groupId: dummyGroupId } },
    { details: 'it returns user with groupId attribute over group attribute', items: [{ id: dummyUserId, groupId: dummyGroupId, group: `${dummyGroupId}-2` }], expected: { id: dummyUserId, groupId: dummyGroupId } }
  ])('.test $details', async ({ items, expected }) => {
    ddbMock.on(QueryCommand, {
      TableName: process.env.USERS_TABLE_NAME,
      IndexName: process.env.USERS_CONNECTION_ID_INDEX_NAME,
      KeyConditionExpression: '#connectionId = :connectionId',
      ExpressionAttributeNames: {
        '#connectionId': 'connectionId'
      },
      ExpressionAttributeValues: {
        ':connectionId': dummyConnectionId
      }
    }).resolves({
      Count: items.length,
      Items: items
    })

    const response = await getUserFromConnectionId(dummyConnectionId)

    expect(response).toStrictEqual(expected)
  })
})

describe('getBannedUserAndGroup', () => {
  test('it returns banned user and group', async () => {
    ddbMock.on(BatchGetCommand, {
      RequestItems: {
        [process.env.USERS_TABLE_NAME]: {
          Keys: [{ id: dummyBannedId }],
          ProjectionExpression: '#id, #groupId, #connectionId, #banConfirmedUsers, #group',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#groupId': 'groupId',
            '#group': 'group', // for backward compatibility
            '#connectionId': 'connectionId',
            '#banConfirmedUsers': 'banConfirmedUsers'
          }
        },
        [process.env.GROUPS_TABLE_NAME]: {
          Keys: [{ id: dummyGroupId }],
          ProjectionExpression: '#users',
          ExpressionAttributeNames: {
            '#users': 'users'
          }
        }
      }
    }).resolves({
      Responses: {
        [process.env.USERS_TABLE_NAME]: [{ id: dummyBannedId }],
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId }]
      }
    })

    const response = await getBannedUserAndGroup(dummyBannedId, dummyGroupId)

    expect(response).toStrictEqual({ bannedUser: { id: dummyBannedId }, group: { id: dummyGroupId } })
  })
})

describe('handler', () => {
  test.each([
    { details: 'it rejects on undefined user id', user: {} },
    { details: 'it rejects on undefined group id', user: { id: dummyUserId } }
  ])('.test $details', async ({ user }) => {
    // connection id to user
    ddbMock.on(QueryCommand, {
      TableName: process.env.USERS_TABLE_NAME,
      IndexName: process.env.USERS_CONNECTION_ID_INDEX_NAME,
      KeyConditionExpression: '#connectionId = :connectionId',
      ExpressionAttributeNames: {
        '#connectionId': 'connectionId'
      },
      ExpressionAttributeValues: {
        ':connectionId': dummyConnectionId
      }
    }).resolves({
      Count: 1,
      Items: [user]
    })

    const response = await handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify({})
    })

    expect(response).toStrictEqual({
      message: 'user or group cannot be found',
      statusCode: 403
    })
  })

  test.each([
    { details: 'it throws on undefined bannedId', body: { messageid: 'messageId' } },
    { details: 'it throws on undefined messageId', body: { bannedid: 'bannedId' } }
  ])('.test $details', async ({ body }) => {
    // connection id to user
    ddbMock.on(QueryCommand, {
      TableName: process.env.USERS_TABLE_NAME,
      IndexName: process.env.USERS_CONNECTION_ID_INDEX_NAME,
      KeyConditionExpression: '#connectionId = :connectionId',
      ExpressionAttributeNames: {
        '#connectionId': 'connectionId'
      },
      ExpressionAttributeValues: {
        ':connectionId': dummyConnectionId
      }
    }).resolves({
      Count: 1,
      Items: [{ id: dummyUserId, group: dummyGroupId }]
    })

    await expect(handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify(body)
    })).rejects.toThrow('bannedid and messageid must be defined')
  })

  test('it rejects if user id and bannedId are the same', async () => {
    // connection id to user
    ddbMock.on(QueryCommand, {
      TableName: process.env.USERS_TABLE_NAME,
      IndexName: process.env.USERS_CONNECTION_ID_INDEX_NAME,
      KeyConditionExpression: '#connectionId = :connectionId',
      ExpressionAttributeNames: {
        '#connectionId': 'connectionId'
      },
      ExpressionAttributeValues: {
        ':connectionId': dummyConnectionId
      }
    }).resolves({
      Count: 1,
      Items: [{ id: dummyUserId, group: dummyGroupId }]
    })

    const response = await handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify({ bannedid: dummyUserId, messageid: 'messageId' })
    })

    expect(response).toStrictEqual({
      message: `user (${dummyUserId}) tried to ban itself`,
      statusCode: 403
    })
  })

  test.each([
    { details: 'with groupId', bannedUser: { id: dummyBannedId, groupId: `${dummyGroupId}-2` } },
    { details: 'with group', bannedUser: { id: dummyBannedId, group: `${dummyGroupId}-2` } }
  ])('it rejects if banned user and user not in the same group ($details)', async ({ bannedUser }) => {
    // connection id to user
    ddbMock.on(QueryCommand, {
      TableName: process.env.USERS_TABLE_NAME,
      IndexName: process.env.USERS_CONNECTION_ID_INDEX_NAME,
      KeyConditionExpression: '#connectionId = :connectionId',
      ExpressionAttributeNames: {
        '#connectionId': 'connectionId'
      },
      ExpressionAttributeValues: {
        ':connectionId': dummyConnectionId
      }
    }).resolves({
      Count: 1,
      Items: [{ id: dummyUserId, group: dummyGroupId }]
    })
    // banned user and group
    ddbMock.on(BatchGetCommand, {
      RequestItems: {
        [process.env.USERS_TABLE_NAME]: {
          Keys: [{ id: dummyBannedId }],
          ProjectionExpression: '#id, #groupId, #connectionId, #banConfirmedUsers, #group',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#groupId': 'groupId',
            '#group': 'group', // for backward compatibility
            '#connectionId': 'connectionId',
            '#banConfirmedUsers': 'banConfirmedUsers'
          }
        },
        [process.env.GROUPS_TABLE_NAME]: {
          Keys: [{ id: dummyGroupId }],
          ProjectionExpression: '#users',
          ExpressionAttributeNames: {
            '#users': 'users'
          }
        }
      }
    }).resolves({
      Responses: {
        [process.env.USERS_TABLE_NAME]: [bannedUser],
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId }]
      }
    })

    const response = await handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify({ bannedid: dummyBannedId, messageid: 'messageId' })
    })

    expect(response).toStrictEqual({
      message: `user (${dummyUserId}) and banned user (${bannedUser.id}) are not in the same group`,
      statusCode: 403
    })
  })
})
