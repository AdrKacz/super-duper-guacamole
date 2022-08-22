// TRIGGER
// HTTP API

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, BatchGetCommand, GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { createVerify } = require('crypto')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)
const snsClient = new SNSClient({ region: AWS_REGION })

/**
 * Share profile to other group users
 *
 * @param {Object} event
 * @param {string} event.requestContext.connectionId
 * @param {Object} event.body
 * @param {Object} event.body.profile
 */
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const body = JSON.parse(event.body)
  const profile = body.profile

  if (typeof profile !== 'object') {
    throw new Error('profile must be an object')
  }

  const user = await verifyUser(body)

  if (typeof user.id !== 'string') {
    return {
      statusCode: 401
    }
  }

  // retreive group
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.group },
    ProjectionExpression: '#id, #users',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users'
    }
  })
  const group = await dynamoDBDocumentClient.send(getGroupCommand).then((response) => (response.Item))
  if (typeof group === 'undefined') {
    console.log('group not defined')
    throw new Error(`group <${user.group}> is not defined`)
  }

  if (!group.users.has(user.id)) {
    console.log('user not in group')
    throw new Error(`user <${user.id}> is not in group <${group.id}>`)
  }

  // retreive users
  const batchGetOtherUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: Array.from(group.users).map((id) => ({ id })),
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  const users = await dynamoDBDocumentClient.send(batchGetOtherUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))
  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: users,
      message: {
        action: 'shareprofile',
        user: user.id,
        profile
      }
    })
  })

  const publishSendNotificationCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      topic: `group-${group.id}`,
      notification: {
        title: 'Les masques tombent 🎭',
        body: "Quelqu'un vient de révéler son identité"
      }
    })
  })

  await Promise.allSettled([
    snsClient.send(publishSendMessageCommand),
    snsClient.send(publishSendNotificationCommand)
  ]).then((results) => console.log(results))

  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
/**
 * Get user id and group id from connection id
 *
 * @param {Object} user
 * @param {string} user.id
 * @param {Object} user.signature
 * @param {number} user.timestamp
 * @param {string} user.publicKey
 */
async function verifyUser ({ id, signature, timestamp, publicKey }) {
  console.log(`signature type: ${typeof signature}`)

  if (typeof id !== 'string') {
    throw new Error('id, must be a string')
  }
  if (!Array.isArray(signature)) {
    throw new Error('signature must be an array')
  }
  if (typeof timestamp !== 'number') {
    throw new Error('timestamp must be a number')
  }
  if (typeof publicKey !== 'string') {
    throw new Error('publicKey must be a string')
  }

  if (Math.abs(Date.now() - timestamp) > 3000) {
    // prevent repeat attack
    return {}
  }

  // user
  const getUserCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id, #publicKey, #group',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#publicKey': 'publicKey',
      '#group': 'group'
    }
  })
  const user = await dynamoDBDocumentClient.send(getUserCommand).then((response) => (response.Item))
  if (user !== undefined && user.publicKey !== undefined) {
    publicKey = user.publicKey
  }

  // verify signature
  const verifier = createVerify('rsa-sha256')
  verifier.update(id + timestamp.toString())
  const isVerified = verifier.verify(publicKey, Buffer.from(signature), 'base64')
  console.log('Is the message verified?', isVerified)
  if (!isVerified) {
    return {}
  }

  return user
}
