// ===== ==== ====
// IMPORTS
const { saveMessage } = require('../src/helpers/save-message')
const { mockClient } = require('aws-sdk-client-mock')

const {
  DynamoDBDocumentClient,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// CONSTANTS
const ddbMock = mockClient(DynamoDBDocumentClient)

const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset mocks
  ddbMock.reset()

  ddbMock.resolves({})

  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test.each([
  { details: 'id undefined', message: { action: 'action' }, errorMessage: 'user.id must be a string' },
  { details: 'message undefined', id: 'id', errorMessage: 'message.action must be a string' },
  { details: 'message.action undefined', id: 'id', message: {}, errorMessage: 'message.action must be a string' }
])('.test it throws when $details', async ({ id, message, errorMessage }) => {
  await expect(saveMessage({ id }, message)).rejects.toThrow(errorMessage)
})

test('it saves message', async () => {
  ddbMock.on(UpdateCommand).resolves()
  await saveMessage({ id: 'id' }, { action: 'action' })

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
