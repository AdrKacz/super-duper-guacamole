// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Reply to a ban request
// event.body
// bannedid : String - banned user id
// status : String - 'confirmed' or 'denied'

// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260
const { sendMessages } = require('chat-backend-package/src/send-messages') // skipcq: JS-0260
const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260
const { leaveGroup } = require('chat-backend-package/src/leave-group') // skipcq: JS-0260

const { getUserAndBannedUser } = require('./src/get-user-and-banned-user')

const { USERS_TABLE_NAME, GROUPS_TABLE_NAME } = process.env

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const response = await putReplyBan(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

/**
 * Reply to a ban request for an user in the group
 * @param event.body.bannedid
 * @param event.body.status
 */
const putReplyBan = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2))

  const jwt = event.requestContext.authorizer.jwt.claims
  const { id, groupId } = await getUser({ id: jwt.id })

  if (typeof groupId !== 'string') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'you don\'t have a group' })
    }
  }

  const body = JSON.parse(event.body)

  const bannedUserId = body.bannedid
  const status = body.status

  if (typeof bannedUserId === 'undefined' || !['confirmed', 'denied'].includes(status)) {
    throw new Error("bannedid must be defined, and status must be either 'confirmed' or 'denied'")
  }

  // get elements involved
  const { user, bannedUser } = await getUserAndBannedUser({ id, bannedUserId })
  const { users } = await getGroup({ groupId })

  const bannedUserGroupId = bannedUser.groupId ?? bannedUser.group // .group for backward compatibility
  if (groupId !== bannedUserGroupId || typeof bannedUser.confirmationRequired === 'undefined') {
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // don't throw an error
    // NOTE: you should warn banned user is not in group anymore
    console.log(`user (${id}) and banned user (${bannedUser.id}) are not in the same group or confirmationRequired is not defined (not in an active ban)`)
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'you are not in the same group as the user banned or banned user is not in a ban vote' })
    }
  }

  const banVotingUsers = bannedUser.banVotingUsers ?? new Set()

  if (!banVotingUsers.has(id)) {
    // NOTE: this situation can happen
    // for example, if you need 2 users to confirm but you send the request to 4
    // once the first 2 have confirm, you can still receive answers
    console.log(`user (${id}) is not in banVotingUsers (below) of banned user (${bannedUserId})`)
    console.log(banVotingUsers)
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: `you cannot vote against (${bannedUserId})` })
    }
  }

  // update banned user
  const dynamicExpressionAttributeNames = {
    '#banVotingUsers': 'banVotingUsers'
  }
  if (status === 'confirmed') {
    dynamicExpressionAttributeNames['#banConfirmedUsers'] = 'banConfirmedUsers'
  }

  const updateBannedUserCommandAddVote = new UpdateCommand({
    ReturnValues: 'ALL_NEW',
    TableName: USERS_TABLE_NAME,
    Key: { id: bannedUserId },
    UpdateExpression: `
${status === 'confirmed' ? 'ADD #banConfirmedUsers :id' : ''}
DELETE #banVotingUsers :id
`,
    ExpressionAttributeNames: dynamicExpressionAttributeNames,
    ExpressionAttributeValues: {
      ':id': new Set([id])
    }
  })

  const updatedBannedUser = await dynamoDBDocumentClient.send(updateBannedUserCommandAddVote).then((response) => (response.Attributes))
  console.log('updatedBannedUser:', updatedBannedUser)

  const updatedBanConfirmerUsers = updatedBannedUser?.banConfirmedUsers ?? new Set()
  const updatedBanVotingUsers = updatedBannedUser?.banVotingUsers ?? new Set()

  const voteConfirmed = updatedBanConfirmerUsers.size >= bannedUser.confirmationRequired
  const voteDenied = updatedBanConfirmerUsers.size + updatedBanVotingUsers.size < bannedUser.confirmationRequired

  if (voteConfirmed || voteDenied) {
    const promises = []
    const otherUsers = users.filter(({ id: userId }) => (userId !== id && userId !== bannedUserId))

    promises.push(sendNotifications({
      users: otherUsers.concat([user]),
      notification: {
        title: 'Le vote est terminé 🗳',
        body: 'Viens voir le résultat !'
      }
    }))

    if (voteConfirmed) {
      console.log(`Vote confirmed with ${updatedBanConfirmerUsers.size} confirmation (${bannedUser.confirmationRequired} needed)`)
      promises.push(leaveGroup({ currentUser: bannedUser }))
      promises.push(
        dynamoDBDocumentClient.send(new UpdateCommand({
          TableName: GROUPS_TABLE_NAME,
          Key: { id: bannedUser.groupId },
          UpdateExpression: 'ADD #bannedUserIds :bannedUserId',
          ExpressionAttributeNames: { '#bannedUserIds': 'bannedUserIds' },
          ExpressionAttributeValues: { ':bannedUserId': new Set([bannedUser.id]) }
        })))

      promises.push(sendMessages({
        users: otherUsers.concat([user, bannedUser]),
        message: {
          action: 'ban-reply',
          bannedid: bannedUserId,
          status: 'confirmed'
        },
        useSaveMessage: true
      }))

      promises.push(sendNotifications({
        users: [bannedUser],
        notification: {
          title: 'Tu as mal agi ❌',
          body: "Ton groupe t'a exclu"
        }
      }))
    } else {
      console.log(`Vote denied with ${updatedBanConfirmerUsers.size + updatedBanVotingUsers.size} confirmation at most (${bannedUser.confirmationRequired} needed)`)
      promises.push(dynamoDBDocumentClient.send(new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: bannedUser.id },
        UpdateExpression: 'REMOVE #banVotingUsers, #banConfirmedUsers, #confirmationRequired',
        ExpressionAttributeNames: {
          '#banVotingUsers': 'banVotingUsers',
          '#banConfirmedUsers': 'banConfirmedUsers',
          '#confirmationRequired': 'confirmationRequired'
        }
      })))
      promises.push(sendMessages({
        users: otherUsers.concat([user]),
        message: {
          action: 'ban-reply',
          bannedid: bannedUserId,
          status: 'denied'
        },
        useSaveMessage: true
      }))
    }

    await Promise.allSettled(promises).then((results) => (console.log(results)))
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id })
  }
}
