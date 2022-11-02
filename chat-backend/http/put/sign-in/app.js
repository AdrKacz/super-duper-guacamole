// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { createVerify } = require('crypto')

const jwt = require('jsonwebtoken')

// ===== ==== ====
// CONSTANTS
const { AWS_REGION, USERS_TABLE_NAME } = process.env

const dynamoDBDocumentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION })
)

const privateKey = `-----BEGIN PRIVATE KEY-----
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
j//esWyle9NGh6Cc9JmRnA5NIwnLGw==
-----END PRIVATE KEY-----`

/**
 * Sign user in
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'signature is not valid' })
    }
  }

  // create token
  // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
  // https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
  // https://accounts.google.com/.well-known/openid-configuration
  const jwtToken = jwt.sign({ id }, privateKey, {
    algorithm: 'RS256',
    keyid: 'id-01',
    expiresIn: 15 * 60,
    notBefore: 0,
    audience: 'user',
    issuer: 'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/298-create-an-http-api-to-receive-command/chat-backend/helpers'
  })

  return {
    statusCode: 200,
    body: JSON.stringify({ jwtToken })
  }
}
