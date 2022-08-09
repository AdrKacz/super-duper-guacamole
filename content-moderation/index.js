const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

require('dotenv').config()
const inquirer = require('inquirer')

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
    SET #isBanned = :true
    `,
    ExpressionAttributeNames: {
      '#isBanned': 'isBanned'
    },
    ExpressionAttributeValues: {
      ':true': true
    }
  })

  await dynamoDBDocumentClient.send(updateUserCommand)

  console.log(`user ${id} is updated (banned)`)
}

async function unbanUserFromPlatform ({ id }) {
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
    REMOVE #isBanned
    `,
    ExpressionAttributeNames: {
      '#isBanned': 'isBanned'
    }
  })

  await dynamoDBDocumentClient.send(updateUserCommand)

  console.log(`user ${id} is updated (unbanned)`)
}

banUserFromPlatform({ id: '8676499d-67d5-46a5-98e7-660f89a0ef31' })

const questions = [
  {
    type: 'input',
    name: 'isBan',
    message: 'Do you want to ban?'
  }
]
