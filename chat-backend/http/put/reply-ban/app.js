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

const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

const { closeVote } = require('./src/close-vote')
const { getUserAndBannedUser } = require('./src/get-user-and-banned-user')
const { leaveGroup } = require('./src/leave-group')

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
  console.log('Received event:', JSON.stringify(event, null, 2))

  const jwt = event.requestContext.authorizer.jwt.claims
  const { id, groupId } = await getUser({ id: jwt.id })

  if (typeof groupId !== 'string') {
    return {
      message: 'you don\'t have a group',
      statusCode: 403
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
      message: `user (${id}) and banned user (${bannedUser.id}) are not in the same group or confirmationRequired is not defined (not in an active ban)`,
      statusCode: 403
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
      message: `user (${id}) is not in banVotingUsers (below) of banned user (${bannedUserId})`,
      statusCode: 403
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
    promises.push(closeVote({ user, bannedUser, otherUsers }))

    if (voteConfirmed) {
      console.log(`Vote confirmed with ${updatedBanConfirmerUsers.size} confirmation (${bannedUser.confirmationRequired} needed)`)
      promises.push(leaveGroup({ currentUser: bannedUser }))

      const publishSendMessageCommand = new PublishCommand({
        TopicArn: SEND_MESSAGE_TOPIC_ARN,
        Message: JSON.stringify({
          users: otherUsers.concat([user, bannedUser]),
          message: {
            action: 'ban-reply',
            bannedid: bannedUserId,
            status: 'confirmed'
          }
        })
      })
      promises.push(snsClient.send(publishSendMessageCommand))

      const publishSendNotificationDeniedBanUserCommand = new PublishCommand({
        TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
        Message: JSON.stringify({
          users: [bannedUser],
          notification: {
            title: 'Tu as mal agi ❌',
            body: "Ton groupe t'a exclu"
          }
        })
      })
      promises.push(snsClient.send(publishSendNotificationDeniedBanUserCommand))
    } else {
      console.log(`Vote denied with ${updatedBanConfirmerUsers.size + updatedBanVotingUsers.size} confirmation at most (${bannedUser.confirmationRequired} needed)`)
      const publishSendMessageCommand = new PublishCommand({
        TopicArn: SEND_MESSAGE_TOPIC_ARN,
        Message: JSON.stringify({
          users: otherUsers.concat([user]),
          message: {
            action: 'ban-reply',
            bannedid: bannedUserId,
            status: 'denied'
          }
        })
      })
      promises.push(snsClient.send(publishSendMessageCommand))
    }

    await Promise.allSettled(promises)
  }

  return {
    statusCode: 200
  }
}
