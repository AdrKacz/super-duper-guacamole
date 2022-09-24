// ===== ==== ====
// IMPORTS
const {
  getUserFromConnectionId,
  getUserAndBannedUserAndGroup,
  closeVote,
  getGroupUsers,
  handler
} = require('../app')
const { mockClient } = require('aws-sdk-client-mock')

// ===== ==== ====
// CONSTANTS
const {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

const dummyConnectionId = 'dummy-connection-id'
const dummyUserId = 'dummy-user-id'
const dummyBannedId = 'dummy-banned-id'
const dummyGroupId = 'dummy-group-id'

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
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
  expect(process.env.SEND_MESSAGE_TOPIC_ARN).toBeDefined()
  expect(process.env.SEND_NOTIFICATION_TOPIC_ARN).toBeDefined()
  expect(process.env.AWS_REGION).toBeDefined()
})

describe('getUserFromConnectionId', () => {
  test.each([
    { details: 'it returns an empty object if no user found', items: [], expected: {} },
    { details: 'it returns an empty object if user has no id', items: [{}], expected: {} },
    { details: 'it returns the first associated user', items: [{ id: dummyUserId }, { id: `${dummyUserId}-2` }], expected: { id: dummyUserId, groupId: undefined } }, // skipcq: JS-0127
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

describe('getUserAndBannedUserAndGroup', () => {
  test.each([
    { details: 'user first', users: [{ id: dummyUserId }, { id: dummyBannedId }] },
    { details: 'banned user first', users: [{ id: dummyBannedId }, { id: dummyUserId }] }
  ])('it returns user, banned user, and group ($details)', async ({ users }) => {
    ddbMock.on(BatchGetCommand, {
      RequestItems: {
        [process.env.USERS_TABLE_NAME]: {
          Keys: [{ id: dummyUserId }, { id: dummyBannedId }],
          ProjectionExpression: '#id, #groupId, #group, #connectionId, #firebaseToken, #banVotingUsers, #confirmationRequired',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#groupId': 'groupId',
            '#group': 'group', // for backward compatibility
            '#connectionId': 'connectionId',
            '#firebaseToken': 'firebaseToken',
            '#banVotingUsers': 'banVotingUsers',
            '#confirmationRequired': 'confirmationRequired'
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
        [process.env.USERS_TABLE_NAME]: users,
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId }]
      }
    })

    const response = await getUserAndBannedUserAndGroup(dummyUserId, dummyBannedId, dummyGroupId)

    expect(response).toStrictEqual({ user: { id: dummyUserId }, bannedUser: { id: dummyBannedId }, group: { id: dummyGroupId } })
  })
})

describe('closeVote', () => {
  test('it updates banned user and alerts users that the vote ended', async () => {
    await closeVote({ id: dummyUserId }, { id: dummyBannedId }, [{ id: 'dummy-other-user-id' }])

    expect(ddbMock).toHaveReceivedNthCommandWith(1, UpdateCommand, {
      TableName: process.env.USERS_TABLE_NAME,
      Key: { id: dummyBannedId },
      UpdateExpression: `
    REMOVE #banVotingUsers, #banConfirmedUsers, #confirmationRequired
    `,
      ExpressionAttributeNames: {
        '#banVotingUsers': 'banVotingUsers',
        '#banConfirmedUsers': 'banConfirmedUsers',
        '#confirmationRequired': 'confirmationRequired'
      }
    })

    expect(snsMock).toHaveReceivedNthCommandWith(1, PublishCommand, {
      TopicArn: process.env.SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: [{ id: 'dummy-other-user-id' }, { id: dummyUserId }],
        notification: {
          title: 'Le vote est terminé 🗳',
          body: 'Viens voir le résultat !'
        }
      })
    })
  })
})

describe('getGroupUsers', () => {
  test('it returns group users without forbidden users', async () => {
    ddbMock.on(BatchGetCommand, {
      RequestItems: {
        [process.env.USERS_TABLE_NAME]: {
          // user and banned user already requested
          Keys: [{ id: 'dummy-other-user-id' }],
          ProjectionExpression: '#id, #connectionId, #firebaseToken',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#connectionId': 'connectionId',
            '#firebaseToken': 'firebaseToken'
          }
        }
      }
    }).resolves({
      Responses: {
        [process.env.USERS_TABLE_NAME]: [{ id: 'dummy-other-user-id' }]
      }
    })
    const response = await getGroupUsers({ users: new Set([dummyUserId, 'dummy-other-user-id']) }, new Set([dummyUserId]))

    expect(response).toStrictEqual([{ id: 'dummy-other-user-id' }])
  })

  test('it returns empty group users when all users are forbidden', async () => {
    const response = await getGroupUsers({ users: new Set([dummyUserId, 'dummy-other-user-id']) }, new Set([dummyUserId, 'dummy-other-user-id']))

    expect(response).toStrictEqual([])
    expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 0)
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
    { details: 'it throws on undefined bannedId', body: { status: 'confirmed' } },
    { details: 'it throws on undefined status', body: { bannedid: 'bannedId' } },
    { details: 'it throws if status is not in the set of accepted values', body: { bannedid: 'bannedId', status: 'not accepted' } }
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
    })).rejects.toThrow("bannedid must be defined, and status must be either 'confirmed' or 'denied'")
  })

  test.each([
    { details: 'banned user and user not in the same group (with groupId)', bannedUser: { id: dummyBannedId, groupId: `${dummyGroupId}-2`, confirmationRequired: 1 } },
    { details: 'banned user and user not in the same group (with group)', bannedUser: { id: dummyBannedId, group: `${dummyGroupId}-2`, confirmationRequired: 1 } },
    { details: 'banned user have confirmationRequired undefined', bannedUser: { id: dummyBannedId, group: `${dummyGroupId}` } }
  ])('it rejects if $details', async ({ bannedUser }) => {
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
    // user, banned user, and group
    ddbMock.on(BatchGetCommand, {
      RequestItems: {
        [process.env.USERS_TABLE_NAME]: {
          Keys: [{ id: dummyUserId }, { id: dummyBannedId }],
          ProjectionExpression: '#id, #groupId, #group, #connectionId, #firebaseToken, #banVotingUsers, #confirmationRequired',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#groupId': 'groupId',
            '#group': 'group', // for backward compatibility
            '#connectionId': 'connectionId',
            '#firebaseToken': 'firebaseToken',
            '#banVotingUsers': 'banVotingUsers',
            '#confirmationRequired': 'confirmationRequired'
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
        [process.env.USERS_TABLE_NAME]: [{ id: dummyUserId, groupId: dummyGroupId }, bannedUser],
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId }]
      }
    })

    // call handler
    const response = await handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify({ bannedid: dummyBannedId, status: 'confirmed' })
    })

    // expect
    expect(response).toStrictEqual({
      message: `user (${dummyUserId}) and banned user (${dummyBannedId}) are not in the same group or confirmationRequired is not defined (not in an active ban)`,
      statusCode: 403
    })
  })

  test.each([
    { details: 'set of voting users undefined', bannedUser: { id: dummyBannedId, groupId: dummyGroupId, confirmationRequired: 1 } },
    { details: 'user not in set of voting users', bannedUser: { id: dummyBannedId, groupId: dummyGroupId, confirmationRequired: 1, banVotingUsers: new Set(['dummy-other-user-id']) } }
  ])('it rejects if user is not in banned user set of voting users ($details)', async ({ bannedUser }) => {
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
    // user, banned user, and group
    ddbMock.on(BatchGetCommand, {
      RequestItems: {
        [process.env.USERS_TABLE_NAME]: {
          Keys: [{ id: dummyUserId }, { id: dummyBannedId }],
          ProjectionExpression: '#id, #groupId, #group, #connectionId, #firebaseToken, #banVotingUsers, #confirmationRequired',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#groupId': 'groupId',
            '#group': 'group', // for backward compatibility
            '#connectionId': 'connectionId',
            '#firebaseToken': 'firebaseToken',
            '#banVotingUsers': 'banVotingUsers',
            '#confirmationRequired': 'confirmationRequired'
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
        [process.env.USERS_TABLE_NAME]: [{ id: dummyUserId, groupId: dummyGroupId }, bannedUser],
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId }]
      }
    })

    // call handler
    const response = await handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify({ bannedid: dummyBannedId, status: 'confirmed' })
    })

    // expect
    expect(response).toStrictEqual({
      message: `user (${dummyUserId}) is not in banVotingUsers (below) of banned user (${dummyBannedId})`,
      statusCode: 403
    })
  })

  test.each([
    { details: 'banConfirmedUsers undefined', updatedBannedUser: { banVotingUsers: new Set(['dummy-other-user-id']) }, confirmationRequired: 1 },
    { details: 'banConfirmedUsers defined', updatedBannedUser: { banConfirmedUsers: new Set(), banVotingUsers: new Set(['dummy-other-user-id']) }, confirmationRequired: 1 }
  ])('it updates banned user (status confirmed) ($details)', async ({ updatedBannedUser, confirmationRequired }) => {
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
    // user, banned user, and group
    ddbMock.on(BatchGetCommand, {
      RequestItems: {
        [process.env.USERS_TABLE_NAME]: {
          Keys: [{ id: dummyUserId }, { id: dummyBannedId }],
          ProjectionExpression: '#id, #groupId, #group, #connectionId, #firebaseToken, #banVotingUsers, #confirmationRequired',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#groupId': 'groupId',
            '#group': 'group', // for backward compatibility
            '#connectionId': 'connectionId',
            '#firebaseToken': 'firebaseToken',
            '#banVotingUsers': 'banVotingUsers',
            '#confirmationRequired': 'confirmationRequired'
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
        [process.env.USERS_TABLE_NAME]: [{ id: dummyUserId, groupId: dummyGroupId }, { id: dummyBannedId, groupId: dummyGroupId, confirmationRequired, banVotingUsers: new Set([dummyUserId]) }],
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId }]
      }
    })
    // update banned user
    ddbMock.on(UpdateCommand, {
      ReturnValues: 'ALL_NEW',
      TableName: process.env.USERS_TABLE_NAME,
      Key: { id: dummyBannedId },
      UpdateExpression: `
    ADD #banConfirmedUsers :id
    DELETE #banVotingUsers :id
    `,
      ExpressionAttributeNames: {
        '#banVotingUsers': 'banVotingUsers',
        '#banConfirmedUsers': 'banConfirmedUsers'
      },
      ExpressionAttributeValues: {
        ':id': new Set([dummyUserId])
      }
    }).resolves({
      Attributes: updatedBannedUser
    })

    // call handler
    const response = await handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify({ bannedid: dummyBannedId, status: 'confirmed' })
    })

    // expect
    expect(response).toStrictEqual({
      statusCode: 200
    })

    expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 0)
  })
})
