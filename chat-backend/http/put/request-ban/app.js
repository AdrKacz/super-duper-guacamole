// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260
const { sendMessages } = require('chat-backend-package/src/send-messages') // skipcq: JS-0260
const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260

const { getBannedUser } = require('./src/get-banned-user')

const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(JSON.parse(event), null, 2))
  const response = await putRequestBan(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

const putRequestBan = async (event) => {
  const jwt = event.requestContext.authorizer.jwt.claims
  const { id, groupId } = await getUser({ id: jwt.id })

  if (typeof groupId !== 'string') {
    console.log(`user (${id}) doesn't have a group`)
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'you don\'t have a group' })
    }
  }

  const body = JSON.parse(event.body)
  console.log('Received body:', JSON.stringify(body, null, 2))

  const bannedId = body.bannedid
  const messageId = body.messageid

  if (typeof bannedId === 'undefined' || typeof messageId === 'undefined') {
    throw new Error('bannedid and messageid must be defined')
  }

  if (id === bannedId) {
    // cannot ban yourself
    console.log(`user (${id}) tried to ban itself`)
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'you can\'t ban yourself' })
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
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'you are not in the same group as the user banned' })
    }
  }

  const { users } = await getGroup({ groupId })

  const banNewVotingUsers = new Set(users.map(({ id: userId }) => (userId)))
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
    promises.push(sendMessages({
      users: users.filter(({ id: userId }) => banNewVotingUsers.has(userId)),
      message: {
        action: 'ban-request',
        messageid: messageId
      },
      useSaveMessage: true
    }))

    promises.push(sendNotifications({
      users: users.filter(({ id: userId }) => banNewVotingUsers.has(userId)),
      notification: {
        title: "Quelqu'un a mal agi ❌",
        body: 'Viens donner ton avis !'
      }
    }))
  }

  await Promise.allSettled(promises)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }
}
