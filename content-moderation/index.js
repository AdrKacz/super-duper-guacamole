const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

require('dotenv').config() // skipcq: JS-0260

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

/**
 * Remove tag to user to prevent it from using the application
 *
 * @param {Object} user
 * @param {string} user.id
 */
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

/**
 * Parse argument to be executed in main
 *
 * @param {string|string[]} arg argument to parse
 */
function parseArg (arg) {
  const arr = Array.isArray(arg) ? arg : [arg]
  const set = new Set(arr)
  set.delete(undefined) // skipcq: JS-0127

  return set
}

/**
 * Receive command line argument and execute function
 *
 * @param {Object} args
 * @param {string|string[]} args.ban user id to ban
 * @param {string|string[]} args.unban user id to unban
 */
async function main (args) {
  const results = []
  for (const id of parseArg(args.ban)) {
    results.push(banUserFromPlatform({ id }))
  }
  await Promise.all(results)

  results.length = 0
  for (const id of parseArg(args.unban)) {
    results.push(unbanUserFromPlatform({ id }))
  }
  await Promise.all(results)
}

main(require('minimist')(process.argv.slice(2), {
  string: ['ban', 'unban'],
  alias: { b: 'ban', u: 'unban' }
})) // skipcq: JS-0260)
