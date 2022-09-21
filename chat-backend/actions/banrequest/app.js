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
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, BatchGetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  GROUPS_TABLE_NAME,
  CONFIRMATION_REQUIRED_STRING,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN,
  AWS_REGION
} = process.env
const CONFIRMATION_REQUIRED = parseInt(CONFIRMATION_REQUIRED_STRING)

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })

const marshallOptions = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`.
  convertEmptyValues: true, // false, by default.
  // Whether to remove undefined values while marshalling.
  removeUndefinedValues: false, // false, by default.
  // Whether to convert typeof object to map attribute.
  convertClassInstanceToMap: false // false, by default.
}

const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false // false, by default.
}

const translateConfig = { marshallOptions, unmarshallOptions }
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient, translateConfig)

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
    return {
      message: 'user or group cannot be found',
      statusCode: 403
    }
  }

  const body = JSON.parse(event.body)

  const bannedId = body.bannedid
  const messageId = body.messageid

  if (typeof bannedId === 'undefined' || typeof messageId === 'undefined') {
    throw new Error('bannedid, and messageid must be defined')
  }

  if (id === bannedId) {
    // cannot ban yourself
    console.log(`user <${id}> banned itself`)
    return {
      statusCode: 403
    }
  }

  // get elements involved
  const { bannedUser, group } = await getBannedUserAndGroup(bannedId, groupId)

  // verify both user in the same group
  if (groupId !== (bannedUser.groupId ?? bannedUser.group)) { // .group for backward compatibility
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // Don't throw an error
    // TODO: warn user banned user is not in group anymore
    console.log(`user (${id}) and banned user (${bannedUser.id}) are not in the same group`)
    return {
      statusCode: 403
    }
  }

  const banConfirmedUsers = bannedUser.banConfirmedUsers ?? new Set()

  const banNewVotingUsers = new Set(group.users)
  banNewVotingUsers.delete(bannedId) // banned user is not part of the vote

  // delete user who have voted and who are voting
  // DO NOT delete users who are voting
  // (if the alert isn't received, the vote will never terminate)
  // TODO: implement a alert queue in the app
  for (const banConfirmedUser of banConfirmedUsers) {
    banNewVotingUsers.delete(banConfirmedUser)
  }

  const confirmationRequired = Math.min(CONFIRMATION_REQUIRED, group.users.size - 1)

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
    const batchGetBanNewVotingUsersCommand = new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE_NAME]: {
          Keys: Array.from(banNewVotingUsers).map((userId) => ({ id: userId })),
          ProjectionExpression: '#id, #connectionId, #firebaseToken',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#connectionId': 'connectionId',
            '#firebaseToken': 'firebaseToken'
          }
        }
      }
    })
    const users = await dynamoDBDocumentClient.send(batchGetBanNewVotingUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

    const publishSendMessageCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users,
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
        users,
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
 * Get all parties of the event (banned user, and group)
 *
 * @param {string} bannedId - banned user id
 * @param {string} groupId - group id
 *
 * @return {Promise<{, bannedUser: Object, group: Object}>}
 */
async function getBannedUserAndGroup (bannedId, groupId) {
  console.log(`Will fetch user (${bannedId}) and group (${groupId})`)
  const batchGetBannedUserAndGroupCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: [{ id: bannedId }],
        ProjectionExpression: '#id, #groupId, #connectionId, #banConfirmedUsers, #group',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#groupId': 'groupId',
          '#group': 'group', // for backward compatibility
          '#connectionId': 'connectionId',
          '#banConfirmedUsers': 'banConfirmedUsers'
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

  const [[bannedUser], [group]] = await dynamoDBDocumentClient.send(batchGetBannedUserAndGroupCommand).then((response) => {
    console.log('getBannedUserAndGroup - response:')
    console.log(response)
    return [response.Responses[USERS_TABLE_NAME], response.Responses[GROUPS_TABLE_NAME]]
  })
  // NOTE: will raise an error if less than one result in users

  console.log('bannedUser:', bannedUser)
  console.log('bannedUser.banConfirmedUsers:', bannedUser.banConfirmedUsers)
  console.log('group:', group)

  return { bannedUser, group }
}

exports.getUserFromConnectionId = getUserFromConnectionId
exports.getBannedUserAndGroup = getBannedUserAndGroup
