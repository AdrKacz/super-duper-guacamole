// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { createVerify } = require('crypto')

const jwt = require('jsonwebtoken') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  AWS_REGION,
  USERS_TABLE_NAME,
  JWK_PRIVATE_KEY,
  AUTHENTICATION_STAGE
} = process.env

const dynamoDBDocumentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION })
)

// ===== ==== ====
// EXPORTS
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
  const jwtToken = jwt.sign({ id }, JWK_PRIVATE_KEY, {
    algorithm: 'RS256',
    keyid: AUTHENTICATION_STAGE,
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
