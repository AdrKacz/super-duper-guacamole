// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Send a ban request
// event.body
// bannedid : String - banned user id
// messageid : String - message id being banned for (to be removed)

// ===== ==== ====
// IMPORTS
const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

const { getUserFromConnectionId } = require('./src/get-user-from-connection-id')
const { getBannedUser } = require('./src/get-banned-user')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN
} = process.env

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  // get id and groupId
  const { id, groupId } = await getUserFromConnectionId(event.requestContext.connectionId)

  if (typeof id === 'undefined' || typeof groupId === 'undefined') {
    return {
      message: 'user or group cannot be found',
      statusCode: 403
    }
  }

  const body = JSON.parse(event.body)

  const bannedId = body.bannedid
  const messageId = body.messageid

  if (typeof bannedId === 'undefined' || typeof messageId === 'undefined') {
    throw new Error('bannedid and messageid must be defined')
  }

  if (id === bannedId) {
    // cannot ban yourself
    console.log(`user (${id}) tried to ban itself`)
    return {
      message: `user (${id}) tried to ban itself`,
      statusCode: 403
    }
  }

  // get elements involved
  const { bannedUser } = await getBannedUser(bannedId)

  // verify both user in the same group
  if (groupId !== (bannedUser.groupId ?? bannedUser.group)) { // .group for backward compatibility
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // Don't throw an error
    // TODO: warn user banned user is not in group anymore, skipcq: JS-0099
    console.log(`user (${id}) and banned user (${bannedUser.id}) are not in the same group`)
    return {
      message: `user (${id}) and banned user (${bannedUser.id}) are not in the same group`,
      statusCode: 403
    }
  }

  const { users } = await getGroup({ groupId })

  const banNewVotingUsers = new Set(users.map(({ id }) => (id)))
  banNewVotingUsers.delete(bannedId) // banned user is not part of the vote

  // delete user who have voted and who are voting
  // DO NOT delete users who are voting
  // (if the alert isn't received, the vote will never terminate)
  // TODO: implement a alert queue in the app, skipcq: JS-0099
  const banConfirmedUsers = bannedUser.banConfirmedUsers ?? new Set()
  for (const banConfirmedUser of banConfirmedUsers) {
    banNewVotingUsers.delete(banConfirmedUser)
  }

  const confirmationRequired = Math.min(parseInt(process.env.CONFIRMATION_REQUIRED_STRING, 10), users.length - 1)

  // update banned user
  // await to send message only after ddb has been updated
  const dynamicExpressionAttributeNames = {
    '#confirmationRequired': 'confirmationRequired'
  }
  const dynamicExpressionAttributeValues = {
    ':confirmationRequired': confirmationRequired
  }
  if (banNewVotingUsers.size > 0) {
    dynamicExpressionAttributeNames['#banVotingUsers'] = 'banVotingUsers'
    dynamicExpressionAttributeValues[':banNewVotingUsers'] = banNewVotingUsers
  }

  const updateBannedUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: bannedId },
    UpdateExpression: `
${banNewVotingUsers.size > 0 ? 'ADD #banVotingUsers :banNewVotingUsers' : ''}
SET #confirmationRequired = :confirmationRequired
`,
    ExpressionAttributeNames: dynamicExpressionAttributeNames,
    ExpressionAttributeValues: dynamicExpressionAttributeValues
  })

  const promises = [dynamoDBDocumentClient.send(updateBannedUserCommand)]

  if (banNewVotingUsers.size > 0) {
    const publishSendMessageCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: users.filter(({ id }) => banNewVotingUsers.has(id)),
        message: {
          action: 'banrequest',
          messageid: messageId
        }
      })
    })
    promises.push(snsClient.send(publishSendMessageCommand))

    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: users.filter(({ id }) => banNewVotingUsers.has(id)),
        notification: {
          title: "Quelqu'un a mal agi ❌",
          body: 'Viens donner ton avis !'
        }
      })
    })
    promises.push(snsClient.send(publishSendNotificationCommand))
  }

  await Promise.allSettled(promises)

  return {
    statusCode: 200
  }
}
