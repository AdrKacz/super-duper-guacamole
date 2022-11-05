// ===== ==== ====
// IMPORTS
const { closeVote } = require('../src/close-vote')
const { mockClient } = require('aws-sdk-client-mock')

const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(DynamoDBDocumentClient)
const snsMock = mockClient(SNSClient)

jest.spyOn(console, 'log')

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()
  snsMock.reset()

  ddbMock.resolves({})
  snsMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it has environment variables', () => {
  expect(process.env.USERS_TABLE_NAME).toBeDefined()
  expect(process.env.SEND_NOTIFICATION_TOPIC_ARN).toBeDefined()
})

test('it updates banned user and notifies users that the vote ended', async () => {
  const id = 'id'
  const bannedUserId = 'banned-user-id'
  const otherUserId = 'other-user-id'
  await closeVote({ user: { id }, bannedUser: { id: bannedUserId }, otherUsers: [{ id: otherUserId }] })

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: bannedUserId },
    UpdateExpression: `
REMOVE #banVotingUsers, #banConfirmedUsers, #confirmationRequired
`,
    ExpressionAttributeNames: {
      '#banVotingUsers': 'banVotingUsers',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#confirmationRequired': 'confirmationRequired'
    }
  })

  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: process.env.SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id: otherUserId }, { id }],
      notification: {
        title: 'Le vote est terminé 🗳',
        body: 'Viens voir le résultat !'
      }
    })
  })
})
