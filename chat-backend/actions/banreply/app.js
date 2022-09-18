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
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, BatchGetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN,
  SWITCH_GROUP_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

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
    return
  }

  const body = JSON.parse(event.body)

  const bannedId = body.bannedid
  const status = body.status

  if (typeof bannedId === 'undefined' || !['confirmed', 'denied'].includes(status)) {
    throw new Error("bannedid must be defined, and status must be either 'confirmed' or 'denied'")
  }

  // get parties
  const { user, bannedUser, group } = await getUserAndBannedUserAndGroup(id, bannedId, groupId)

  const bannedUserGroupId = bannedUser.groupId ?? bannedUser.group // .group for backward compatibility
  if (groupId !== bannedUserGroupId || typeof bannedUser.confirmationRequired === 'undefined') {
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // don't throw an error
    // NOTE: you should warn banned user is not in group anymore
    console.log(`user (${id}) and banned user (${bannedUser.id}) are not in the same group or confirmationRequired is not defined (not in an active ban)`)
    return {
      statusCode: 403
    }
  }

  const banVotingUsers = bannedUser.banVotingUsers ?? new Set()

  if (!banVotingUsers.has(id)) {
    // NOTE: this situation can happen
    // for example, if you need 2 users to confirm but you send the request to 4
    // once the first 2 have confirm, you can still receive answers
    console.log(`user (${id}) is not in banVotingUsers (below) of banned user (${bannedId})`)
    console.log(banVotingUsers)
    return {
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
    Key: { id: bannedId },
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
    // close the vote
    const updateBannedUserCommandCloseVote = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: bannedId },
      UpdateExpression: `
      REMOVE #banVotingUsers, #banConfirmedUsers, #confirmationRequired
      `,
      ExpressionAttributeNames: {
        '#banVotingUsers': 'banVotingUsers',
        '#banConfirmedUsers': 'banConfirmedUsers',
        '#confirmationRequired': 'confirmationRequired'
      }
    })

    const promises = [dynamoDBDocumentClient.send(updateBannedUserCommandCloseVote)]

    const otherUserIds = []
    for (const groupUserId of group.users) {
      if (groupUserId !== id && groupUserId !== bannedId) {
        otherUserIds.push({ id: groupUserId })
      }
    }
    const otherUsers = []
    if (otherUserIds.length > 0) {
      // do not fetch if nothing to fetch
      const batchOtherUsersCommand = new BatchGetCommand({
        RequestItems: {
          [USERS_TABLE_NAME]: {
            // user and banned user already requested
            Keys: Array.from(group.users).filter((userId) => (userId !== bannedId && userId !== id)).map((userId) => ({ id: userId })),
            ProjectionExpression: '#id, #connectionId, #firebaseToken',
            ExpressionAttributeNames: {
              '#id': 'id',
              '#connectionId': 'connectionId',
              '#firebaseToken': 'firebaseToken'
            }
          }
        }
      })
      await dynamoDBDocumentClient.send(batchOtherUsersCommand).then((response) => {
        for (const otherUser of response.Responses[USERS_TABLE_NAME]) {
          otherUsers.push(otherUser)
        }
      })
    }

    if (voteConfirmed) {
      console.log(`Vote confirmed with ${updatedBanConfirmerUsers.size} confirmation (${bannedUser.confirmationRequired} needed)`)
      const publishSwitchGroupCommand = new PublishCommand({
        TopicArn: SWITCH_GROUP_TOPIC_ARN,
        Message: JSON.stringify({
          id: bannedId,
          groupid: bannedUser.groupId,
          isBan: true
        })
      })

      promises.push(snsClient.send(publishSwitchGroupCommand))

      const publishSendMessageCommand = new PublishCommand({
        TopicArn: SEND_MESSAGE_TOPIC_ARN,
        Message: JSON.stringify({
          users: otherUsers.concat([user, bannedUser]),
          message: {
            action: 'banreply',
            bannedid: bannedId,
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
            action: 'banreply',
            bannedid: bannedId,
            status: 'denied'
          }
        })
      })
      promises.push(snsClient.send(publishSendMessageCommand))
    }

    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: otherUsers.concat([user]),
        notification: {
          title: 'Le vote est terminé 🗳',
          body: 'Viens voir le résultat !'
        }
      })
    })
    promises.push(snsClient.send(publishSendNotificationCommand))

    await Promise.allSettled(promises)
  }

  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
/**
 * Get user from its connectionId
 *
 * @param {string} connectionId
 *
 * @return {id: string, groupId: string}
 */
async function getUserFromConnectionId (connectionId) {
  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  })
  const user = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    console.log('Query Response:', response)
    if (response.Count > 0) {
      return response.Items[0]
    }
    return {}
  })

  if (typeof user.id === 'undefined') {
    return {}
  }
  return { id: user.id, groupId: user.groupId ?? user.group } // .group for backward compatibility
}

/**
 * Get all parties of the event (user, banned user, and group)
 *
 * @param {string} id - user id
 * @param {string} bannedId - banned user id
 * @param {string} groupId - group id
 *
 * @return {Promise<{user: Object, bannedUser: Object, group: Object}>}
 */
async function getUserAndBannedUserAndGroup (id, bannedId, groupId) {
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: [{ id }, { id: bannedId }],
        ProjectionExpression: '#id, #groupId, #group, #connectionId, #firebaseToken, #banVotingUsers, #confirmationRequired',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#groupId': 'groupId',
          '#group': 'group', // for backward compatibility
          '#connectionId': 'connectionId',
          '#firebaseToken': 'firebaseToken',
          '#banVotingUsers': 'banVotingUsers',
          '#confirmationRequired': 'confirmationRequired'
        }
      },
      [GROUPS_TABLE_NAME]: {
        Keys: [{ id: groupId }],
        ProjectionExpression: '#users',
        ExpressionAttributeNames: {
          '#users': 'users'
        }
      }
    }
  })

  const [users, [group]] = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => ([response.Responses[USERS_TABLE_NAME], response.Responses[GROUPS_TABLE_NAME]]))
  // NOTE: will raise an error if less than two results in users

  let [user, bannedUser] = users
  if (user.id !== id) {
    user = users[1]
    bannedUser = users[0]
  }
  console.log('user:', user)
  console.log('bannedUser:', bannedUser)
  console.log('group:', group)

  return { user, bannedUser, group }
}
