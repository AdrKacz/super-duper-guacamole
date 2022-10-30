// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { sendMessages } = require('file:../../../chat-backend-package')

const { createVerify } = require('crypto')

const jwt = require('jsonwebtoken')

// ===== ==== ====
// CONSTANTS
const { AWS_REGION, USERS_TABLE_NAME } = process.env

const dynamoDBDocumentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION })
)

/**
 * Get user status
 *
 * @param {Object} event
 */
exports.handler = async (event) => {
  const body = JSON.parse(event.body)

  const id = body.id
  const timestamp = body.timestamp
  const signature = body.signature

  if (typeof id !== 'string' || typeof timestamp !== 'number' || typeof signature === 'undefined') {
    throw new Error('id, timestamp and signature must be defined with correct type')
  }

  if (Math.abs(Date.now() - timestamp) > 3000) {
    // prevent repeat attack
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'timestamp is not valid' })
    }
  }

  const getCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#publicKey, #isBanned',
    ExpressionAttributeNames: {
      '#publicKey': 'publicKey',
      '#isBanned': 'isBanned'
    }
  })

  // will throw an error if item not found 'Right side of assignment cannot be destructured'
  const { publicKey, isBanned } = await dynamoDBDocumentClient.send(getCommand).then((response) => (response.Item))

  // verify is not banned
  if (typeof isBanned === 'boolean' && isBanned) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'you are banned' })
    }
  }

  // verify signature
  const verifier = createVerify('rsa-sha256')
  verifier.update(id + timestamp.toString())
  const isVerified = verifier.verify(publicKey, Buffer.from(signature), 'base64')
  console.log('is the message verified?', isVerified)
  if (!isVerified) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'signature is not valid' })
    }
  }

  // create token
  const jwtToken = jwt.sign({ scp: '???' }, 'private_key', {
    algorithm: 'RS256',
    keyid: '???',
    expiresIn: 10 * 60,
    notBefore: 0,
    audience: 'user',
    issuer: '???'
  })

  await sendMessages({
    users: [{ id, connectionId: event.requestContext.connectionId }],
    message: {
      action: 'sign-in',
      jwtToken
    },
    useSaveMessage: false
  })
}
