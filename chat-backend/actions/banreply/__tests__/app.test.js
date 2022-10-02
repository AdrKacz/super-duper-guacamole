// ===== ==== ====
// IMPORTS
const {
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

  test('it notifies user if the vote ended with a confirmation', async () => {
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
        [process.env.USERS_TABLE_NAME]: [{ id: dummyUserId, groupId: dummyGroupId }, { id: dummyBannedId, groupId: dummyGroupId, confirmationRequired: 1, banVotingUsers: new Set([dummyUserId]) }],
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId, users: new Set([dummyUserId, dummyBannedId]) }]
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
      Attributes: {
        banConfirmedUsers: new Set([dummyUserId]) // size 1 and confirmationRequired 1 implies voteConfirmed
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
    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
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
    })

    expect(response).toStrictEqual({
      statusCode: 200
    })

    expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 4)

    expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
      TopicArn: process.env.SWITCH_GROUP_TOPIC_ARN,
      Message: JSON.stringify({
        id: dummyBannedId,
        groupid: dummyGroupId,
        isBan: true
      })
    })

    expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
      TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: [{ id: dummyUserId, groupId: dummyGroupId }, { id: dummyBannedId, groupId: dummyGroupId, confirmationRequired: 1, banVotingUsers: new Set([]) }],
        message: {
          action: 'banreply',
          bannedid: dummyBannedId,
          status: 'confirmed'
        }
      })
    })

    expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
      TopicArn: process.env.SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: [{ id: dummyBannedId, groupId: dummyGroupId, confirmationRequired: 1, banVotingUsers: new Set([]) }],
        notification: {
          title: 'Tu as mal agi ❌',
          body: "Ton groupe t'a exclu"
        }
      })
    })
  })

  test('it notifies user if the vote ended with a denial', async () => {
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
        [process.env.USERS_TABLE_NAME]: [{ id: dummyUserId, groupId: dummyGroupId }, { id: dummyBannedId, groupId: dummyGroupId, confirmationRequired: 1, banVotingUsers: new Set([dummyUserId]) }],
        [process.env.GROUPS_TABLE_NAME]: [{ id: dummyGroupId, users: new Set([dummyUserId, dummyBannedId]) }]
      }
    })
    // update banned user
    ddbMock.on(UpdateCommand, {
      ReturnValues: 'ALL_NEW',
      TableName: process.env.USERS_TABLE_NAME,
      Key: { id: dummyBannedId },
      UpdateExpression: `

DELETE #banVotingUsers :id
`,
      ExpressionAttributeNames: {
        '#banVotingUsers': 'banVotingUsers'
      },
      ExpressionAttributeValues: {
        ':id': new Set([dummyUserId])
      }
    }).resolves({
      Attributes: {
        // no banVotingUsers and no banConfirmedUsers and confirmationRequired 1 implies voteDenied
      }
    })

    // call handler
    const response = await handler({
      requestContext: {
        connectionId: dummyConnectionId
      },
      body: JSON.stringify({ bannedid: dummyBannedId, status: 'denied' })
    })

    // expect
    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      ReturnValues: 'ALL_NEW',
      TableName: process.env.USERS_TABLE_NAME,
      Key: { id: dummyBannedId },
      UpdateExpression: `

DELETE #banVotingUsers :id
`,
      ExpressionAttributeNames: {
        '#banVotingUsers': 'banVotingUsers'
      },
      ExpressionAttributeValues: {
        ':id': new Set([dummyUserId])
      }
    })

    expect(response).toStrictEqual({
      statusCode: 200
    })

    expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)

    expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
      TopicArn: process.env.SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: [{ id: dummyUserId, groupId: dummyGroupId }],
        message: {
          action: 'banreply',
          bannedid: dummyBannedId,
          status: 'denied'
        }
      })
    })
  })
})
