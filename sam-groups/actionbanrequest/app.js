// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Switch group
// event.body
// id : String - user id
// groupid : String - user group id
// bannedid : String - banned user id
// messageid : String - message id being banned for (to be removed)

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, BatchGetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
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
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const body = JSON.parse(event.body)

  const id = body.id
  const groupid = body.groupid
  const bannedid = body.bannedid
  const messageid = body.messageid

  if (id === undefined || groupid === undefined || bannedid === undefined || messageid === undefined) {
    throw new Error('id, groupid, bannedid, and messageid must be defined')
  }

  if (id === bannedid) {
    // cannot ban yourself
    console.log(`user <${id}> banned itself`)
    return {
      statusCode: 403
    }
  }

  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: [{ id: id }, { id: bannedid }],
        ProjectionExpression: '#id, #group, #connectionId, #banVotingUsers, #banConfirmedUsers',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#group': 'group',
          '#connectionId': 'connectionId',
          '#banVotingUsers': 'banVotingUsers',
          '#banConfirmedUsers': 'banConfirmedUsers'
        }
      },
      [GROUPS_TABLE_NAME]: {
        Keys: [{ id: groupid }],
        ProjectionExpression: '#users',
        ExpressionAttributeNames: {
          '#users': 'users'
        }
      }
    }
  })

  const [users, [group]] = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => ([response.Responses[USERS_TABLE_NAME], response.Responses[GROUPS_TABLE_NAME]]))
  let user, bannedUser
  if (users[0].id === id) {
    user = users[0]
    bannedUser = users[1]
  } else {
    user = users[1]
    bannedUser = users[0]
  }
  console.log('user:', user)
  console.log('bannedUser:', bannedUser)
  console.log('bannedUser.banVotingUsers:', bannedUser.banVotingUsers)
  console.log('bannedUser.banConfirmedUsers:', bannedUser.banConfirmedUsers)
  console.log('group:', group)

  // verify both user and their group (must be the same)
  if (user === undefined || user.connectionId === undefined || user.group === undefined) {
    throw new Error(`user <${id}> is not defined or has no connectionId or had no group`)
  }

  // need to verify identify instead
  // if (user.connectionId !== event.requestContext.connectionId) {
  //   throw new Error(`user <${id}> has connectionId <${user.connectionId}> but sent request via connectionId <${event.requestContext.connectionId}>`)
  // }

  if (bannedUser === undefined || bannedUser.group !== user.group) {
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // Don't throw an error
    // TODO: warn user banned user is not in group anymore
    console.log(`banned user <${bannedid}> is not defined or banned user and user are not in the same group`)
    return {
      statusCode: 403
    }
  }

  const banVotingUsers = bannedUser.banVotingUsers ?? new Set()
  const banConfirmedUsers = bannedUser.banConfirmedUsers ?? new Set()

  const banNewVotingUsers = new Set(group.users)
  banNewVotingUsers.delete(bannedid) // banned user is not part of the vote

  // NOTE: delete user who have voted and who are voting
  // to not spam the app: the app CANNOT handle multiple banrequest
  // TODO: implement a queue for banrequest in the app
  for (const banVotingUser of banVotingUsers) {
    banNewVotingUsers.delete(banVotingUser)
  }
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
    Key: { id: bannedid },
    UpdateExpression: `
    ${banNewVotingUsers.size > 0 ? 'ADD #banVotingUsers :banNewVotingUsers' : ''}
    SET #confirmationRequired = :confirmationRequired
    `,
    ExpressionAttributeNames: dynamicExpressionAttributeNames,
    ExpressionAttributeValues: dynamicExpressionAttributeValues
  })

  const promises = [dynamoDBDocumentClient.send(updateBannedUserCommand)]

  if (banNewVotingUsers.size > 0) {
    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        topic: `group-${bannedUser.group}`,
        notification: {
          title: "Quelqu'un a mal agi ❌",
          body: 'Viens donner ton avis !'
        }
      })
    })
    promises.push(snsClient.send(publishSendNotificationCommand))

    const batchGetBanNewVotingUsersCommand = new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE_NAME]: {
          Keys: Array.from(banNewVotingUsers).map((id) => ({ id: id })),
          ProjectionExpression: '#id, #connectionId',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#connectionId': 'connectionId'
          }
        }
      }
    })
    const users = await dynamoDBDocumentClient.send(batchGetBanNewVotingUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

    const publishSendMessageCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: users,
        message: {
          action: 'banrequest',
          messageid: messageid
        }
      })
    })
    promises.push(snsClient.send(publishSendMessageCommand))
  }

  await Promise.allSettled(promises)

  return {
    statusCode: 200
  }
}
