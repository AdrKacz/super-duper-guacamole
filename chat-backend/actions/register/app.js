// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Register connectionId
// event.body
// id : String - userid
// signature : List<Int>
// timestamp : int - when the signature was generated
//      -- message is only valid for +/- 3 seconds (3000 milliseconds)
// publicKey: String - PEM format, base64 encoded

// ===== ==== ====
// IMPORTS
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { createVerify } = require('crypto')

const { informGroup, getOtherGroupUsers } = require('./helpers')

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN
} = process.env

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

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
  if (typeof user !== 'undefined' && typeof user.publicKey !== 'undefined') {
    publicKey = user.publicKey
  }

  // verify signature
  const verifier = createVerify('rsa-sha256')
  verifier.update(id + timestamp.toString())
  const isVerified = verifier.verify(publicKey, Buffer.from(signature), 'base64')
  console.log('Is the message verified?', isVerified)
  if (!isVerified) {
    return {
      message: 'signature is not valid',
      statusCode: 401
    }
  }

  // update user and retrieve old unreadData (if any)
  const updateCommand = new UpdateCommand({
    ReturnValues: 'ALL_OLD',
    TableName: USERS_TABLE_NAME,
    Key: { id },
    UpdateExpression: `
    SET #isInactive = :false, #connectionId = :connectionId, #publicKey = :publicKey
    REMOVE #unreadData
    `,
    ExpressionAttributeNames: {
      '#isInactive': 'isInactive',
      '#connectionId': 'connectionId',
      '#publicKey': 'publicKey',
      '#unreadData': 'unreadData'
    },
    ExpressionAttributeValues: {
      ':connectionId': event.requestContext.connectionId,
      ':publicKey': publicKey,
      ':false': false
    }
  })
  const updatedUser = await dynamoDBDocumentClient.send(updateCommand).then((response) => (response.Attributes))

  const message = {
    action: 'register'
  }

  // New User
  if (typeof updatedUser === 'undefined') {
    message.unreadData = []
    const publishCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: [{ id, connectionId: event.requestContext.connectionId }],
        message: message
      })
    })
    snsClient.send(publishCommand)
    return {
      statusCode: 200
    }
  }

  // Update User is defined
  const promises = []
  if (typeof updatedUser.unreadData !== 'undefined') {
    message.unreadData = updatedUser.unreadData
  }

  // Retreive other group users
  try {
    const users = await getOtherGroupUsers(id, updatedUser.group)
    promises.push(informGroup(id, users))

    message.group = updatedUser.group
    message.groupUsers = users.map(({ id: userId, connectionId }) => ({ userId, isOnline: typeof connectionId !== 'undefined' }))
  } catch (e) {
    if (e.message === `groupId <${updatedUser.group}> is undefined`) {
      console.log(e)
    } else if (e.message === `group <${updatedUser.group}> isn't found`) {
      console.log(e)
    } else {
      throw e
    }
  }

  // send message
  const publishCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, connectionId: event.requestContext.connectionId }],
      message: message
    })
  })
  promises.push(snsClient.send(publishCommand))

  await Promise.allSettled(promises)

  return {
    statusCode: 200
  }
}
