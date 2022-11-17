// ===== ==== ====
// IMPORTS
const { GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

const { createVerify } = require('node:crypto')

// ===== ==== ====
// CONSTANTS
const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Verify user identity
 *
 * @param {Object} event
 *
 * @return {boolean}
 */
exports.verifyIdentity = async (event) => {
  const body = JSON.parse(event.body)

  const id = body.id
  const signature = body.signature
  const timestamp = body.timestamp

  let publicKey = body.publicKey // updated later if it already exists
  if (typeof id === 'undefined' || typeof signature === 'undefined' || typeof timestamp === 'undefined' || typeof publicKey === 'undefined') {
    throw new Error('id, signature, timestamp, and publicKey must be defined')
  }

  if (Math.abs(Date.now() - timestamp) > 3000) {
    // prevent repeat attack
    return {
      message: 'timestamp is not valid',
      statusCode: 401
    }
  }

  // user
  console.log('[DEBUG] will send get command')
  const user = await dynamoDBDocumentClient.send(new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id, #publicKey, #isBanned',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#publicKey': 'publicKey',
      '#isBanned': 'isBanned'
    }
  })).then((response) => (response.Item)).catch((e) => (console.log(e)))

  console.log(`[DEBUG] user is ${JSON.stringify(user)}`)
  if (typeof user === 'object' && typeof user.publicKey === 'string') {
    publicKey = user.publicKey
  }

  // verify is not banned
  if (typeof user === 'object' && typeof user.isBanned === 'boolean' && user.isBanned) {
    return {
      message: 'user is banned',
      statusCode: 403
    }
  }

  // verify signature
  const verifier = createVerify('rsa-sha256')
  verifier.update(id + timestamp.toString())
  const isVerified = verifier.verify(publicKey, Buffer.from(signature), 'base64')
  console.log('Is the message verified?', isVerified)
  if (!isVerified) {
    return {
      message: 'signature is not valid',
      statusCode: 403
    }
  }

  return { id, publicKey, isValid: true }
}
