// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Switch group
// event.body
// bannedid : String - banned user id
// messageid : String - message id being banned for (to be removed)

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, BatchGetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

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
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const body = JSON.parse(event.body)

  const bannedid = body.bannedid
  const messageid = body.messageid

  if (bannedid === undefined || messageid === undefined) {
    throw new Error('bannedid, and messageid must be defined')
  }

  // get userid and groupid
  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': event.requestContext.connectionId
    }
  })
  const tempUser = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    console.log('Query Response:', response)
    if (response.Count > 0) {
      return response.Items[0]
    } else {
      return undefined
    }
  })

  if (tempUser === undefined || tempUser.id === undefined || tempUser.group === undefined) {
    return
  }
  const id = tempUser.id
  const groupid = tempUser.group

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
        ProjectionExpression: '#id, #group, #connectionId, #banConfirmedUsers',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#group': 'group',
          '#connectionId': 'connectionId',
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

  const banConfirmedUsers = bannedUser.banConfirmedUsers ?? new Set()

  const banNewVotingUsers = new Set(group.users)
  banNewVotingUsers.delete(bannedid) // banned user is not part of the vote

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
    const batchGetBanNewVotingUsersCommand = new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE_NAME]: {
          Keys: Array.from(banNewVotingUsers).map((id) => ({ id: id })),
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
        users: users,
        message: {
          action: 'banrequest',
          messageid: messageid
        }
      })
    })
    promises.push(snsClient.send(publishSendMessageCommand))

    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: users,
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
