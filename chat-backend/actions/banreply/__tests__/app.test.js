// ===== ==== ====
// IMPORTS
const {
  getUserFromConnectionId,
  getUserAndBannedUserAndGroup,
  closeVote
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
