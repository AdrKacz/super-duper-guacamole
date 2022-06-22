// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// HTTP API

// ===== ==== ====
// EVENT
// Send message
// event.body
// id : String - user id
// signature : List<Int>
// timestamp : int - when the signature was generated
//      -- message is only valid for +/- 3 seconds (3000 milliseconds)
// publicKey: String - PEM format, base64 encoded
// token: String - user firebase notification token

// NOTE:
// could take connectionIds as input to not retrieve it twice
// need to be linked with userids in case some are undefined or stales

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { createVerify } = require('crypto')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
`)

  const body = JSON.parse(event.body)

  const id = body.id
  const signature = body.signature
  const timestamp = body.timestamp
  let publicKey = body.publicKey // updated later if it already exists
  const token = body.token
  if (id === undefined || signature === undefined || timestamp === undefined || publicKey === undefined || token === undefined) {
    throw new Error('id, signature, timestamp, publicKey, and token must be defined')
  }

  if (Math.abs(Date.now() - timestamp) > 3000) {
    // prevent repeat attack
    return {
      statusCode: 401
    }
  }

  // user
  const getUserCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id, #publicKey',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#publicKey': 'publicKey'
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
    return {
      statusCode: 401
    }
  }

  const updateCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET #firebaseToken = :token, #publicKey = :publicKey',
    ExpressionAttributeNames: {
      '#firebaseToken': 'firebaseToken',
      '#publicKey': 'publicKey'
    },
    ExpressionAttributeValues: {
      ':token': token,
      ':publicKey': publicKey
    }
  })

  await dynamoDBDocumentClient.send(updateCommand)

  return {
    statusCode: 200
  }
}
