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
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { verifyIdentity } = require('./src/verify-identity')

const { informGroup, getOtherGroupUsers } = require('./src/helpers')

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

const { snsClient } = require('./src/aws-clients')

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

  const validation = await verifyIdentity(event)
  console.log('\n\n\nIMPORTANT')
  console.log(validation)
  if (!validation.isValid) {
    return validation
  }
  const { id, publicKey } = validation

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
  const oldUser = await dynamoDBDocumentClient.send(updateCommand).then((response) => (response.Attributes))

  const registerMessage = {
    action: 'register',
    unreadData: []
  }

  // New User
  if (typeof oldUser === 'undefined') {
    console.log('Register New User')

    const publishCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: [{ id, connectionId: event.requestContext.connectionId }],
        message: registerMessage
      })
    })
    await snsClient.send(publishCommand)
    return {
      statusCode: 200
    }
  }

  // old User is defined
  console.log('Old User')
  console.log(oldUser)
  const promises = []

  // add unread messages
  if (Array.isArray(oldUser.unreadData)) {
    console.log('Update Message With Unread Data')

    registerMessage.unreadData = oldUser.unreadData
  }

  // add group
  const groupId = oldUser.groupId ?? oldUser.group // .group for backward compatibility
  registerMessage.groupId = groupId
  registerMessage.group = groupId // for backward compatibility

  // Retreive other group users
  try {
    console.log('Get other users in group')
    const users = await getOtherGroupUsers(id, registerMessage.groupId)
    console.log('Inform other users')
    promises.push(informGroup(id, users))
    registerMessage.groupUsers = users.map(({ id: userId, connectionId }) => ({ id: userId, isOnline: typeof connectionId === 'string' }))
  } catch (e) {
    console.log('Catch: ', e)
  }

  console.log('Send Register Message:\n', JSON.stringify(registerMessage))
  // send message
  const publishCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, connectionId: event.requestContext.connectionId }],
      message: registerMessage
    })
  })
  promises.push(snsClient.send(publishCommand))

  await Promise.allSettled(promises)

  return {
    statusCode: 200
  }
}
