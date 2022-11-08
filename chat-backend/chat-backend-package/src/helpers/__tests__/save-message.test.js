// ===== ==== ====
// IMPORTS
const { saveMessage } = require('../save-message')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(DynamoDBDocumentClient)

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})
})

// ===== ==== ====
// TESTS
test('it throws when id undefined', async () => {
  await expect(saveMessage({
    user: {}, message: { action: 'action' }
  })).rejects.toThrow('user.id must be a string')
})

test('it saves message', async () => {
  ddbMock.on(UpdateCommand).resolves()
  await saveMessage({ user: { id: 'id' }, message: { action: 'action' } })

  expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: process.env.USERS_TABLE_NAME,
    Key: { id: 'id' },
    UpdateExpression: `
SET #unreadData = list_append(if_not_exists(#unreadData, :emptyList), :message)
REMOVE #connectionId
        `,
    ExpressionAttributeNames: {
      '#unreadData': 'unreadData',
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':message': [{ action: 'action' }],
      ':emptyList': []
    }
  })
})
