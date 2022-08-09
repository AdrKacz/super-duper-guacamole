const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

require('dotenv').config()

const {
  AWS_REGION,
  USERS_TABLE_NAME
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

/**
 * Add a tag to user to prevent it from using the application
 * The tag will be send on register and the application will
 * stop working it is set to true
 *
 * @param {Object} user
 * @param {string} user.id
 */
async function banUserFromPlatform ({ id }) {
  const getUserCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id',
    ExpressionAttributeNames: {
      '#id': 'id'
    }
  })

  const user = await dynamoDBDocumentClient.send(getUserCommand).then((response) => (response.Item))

  if (typeof user === 'undefined') {
    console.log(`user ${id} is undefined`)
    return
  }

  const updateUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    UpdateExpression: `
    SET #isBlocked = :true
    `,
    ExpressionAttributeNames: {
      '#isBlocked': 'isBlocked'
    },
    ExpressionAttributeValues: {
      ':true': true
    }
  })

  await dynamoDBDocumentClient.send(updateUserCommand)

  console.log(`user ${id} is updated`)
}

banUserFromPlatform({ id: '8676499d-67d5-46a5-98e7-660f89a0ef31' })
