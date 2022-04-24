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
// groupid : String  - user group id
// bannedid : String - banned user id
// status : String - 'confirmed' or 'denied'

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
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN,
  SWITCH_GROUP_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

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
  const status = body.status

  if (id === undefined || groupid === undefined || bannedid === undefined || !['confirmed', 'denied'].includes(status)) {
    throw new Error("id and bannedid must be defined, and status must be either 'confirmed' or 'denied'")
  }

  // get users
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: [{ id: id }, { id: bannedid }],
        ProjectionExpression: '#id, #group, #connectionId, #banVotingUsers, #confirmationRequired',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#group': 'group',
          '#connectionId': 'connectionId',
          '#banVotingUsers': 'banVotingUsers',
          '#confirmationRequired': 'confirmationRequired'
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
  console.log('group:', group)

  // verify both user and their group (must be the same)
  if (user === undefined || user.connectionId === undefined || user.group === undefined) {
    throw new Error(`user <${id}> is not defined or has no connectionId or had no group`)
  }

  // need to verify identify instead
  // if (user.connectionId !== event.requestContext.connectionId) {
  //   throw new Error(`user <${id}> has connectionId <${user.connectionId}> but sent request via connectionId <${event.requestContext.connectionId}>`)
  // }

  if (bannedUser === undefined || bannedUser.group !== user.group || bannedUser.confirmationRequired === undefined) {
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // don't throw an error
    // TODO: warn user banned user is not in group anymore
    console.log(`banned user <${bannedid}> is not defined or banned user and user are not in the same group or confirmationRequired is not defined (not in an active ban)`)
    return {
      statusCode: 403
    }
  }

  const banVotingUsers = bannedUser.banVotingUsers ?? new Set()

  if (!banVotingUsers.has(id)) {
    // NOTE: this situation can happen
    // for example, if you need 2 users to confirm but you send the request to 4
    // once the first 2 have confirm, you can still receive answers
    console.log(`user <${id}> is not in banVotingUsers (below) of banned user <${bannedid}>`)
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

  const updateBannedUserCommand = new UpdateCommand({
    ReturnValues: 'UPDATED_NEW',
    TableName: USERS_TABLE_NAME,
    Key: { id: bannedid },
    UpdateExpression: `
    ${status === 'confirmed' ? 'ADD #banConfirmedUsers :id' : ''}
    DELETE #banVotingUsers :id
    `,
    ExpressionAttributeNames: dynamicExpressionAttributeNames,
    ExpressionAttributeValues: {
      ':id': new Set([id])
    }
  })

  const updatedBannedUser = await dynamoDBDocumentClient.send(updateBannedUserCommand).then((response) => (response.Attributes))
  console.log('updatedBannedUser:', updatedBannedUser)

  const updatedBanConfirmerUsers = updatedBannedUser?.banConfirmedUsers ?? new Set()
  const updatedBanVotingUsers = updatedBannedUser?.banVotingUsers ?? new Set()

  const voteConfirmed = updatedBanConfirmerUsers.size >= bannedUser.confirmationRequired
  const voteDenied = updatedBanConfirmerUsers.size + updatedBanVotingUsers.size < bannedUser.confirmationRequired

  // NOTE: here we inform all the group - even the user aimed by the vote - of the result
  if (voteConfirmed || voteDenied) {
    // close the vote
    const updateBannedUserCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: bannedid },
      UpdateExpression: `
      REMOVE #banVotingUsers, #banConfirmedUsers, #confirmationRequired
      `,
      ExpressionAttributeNames: {
        '#banVotingUsers': 'banVotingUsers',
        '#banConfirmedUsers': 'banConfirmedUsers',
        '#confirmationRequired': 'confirmationRequired'
      }
    })

    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        topic: `group-${bannedUser.group}`,
        notification: {
          title: 'Le vote est terminé 🗳',
          body: 'Viens voir le résultat !'
        }
      })
    })
    const promises = [
      dynamoDBDocumentClient.send(updateBannedUserCommand),
      snsClient.send(publishSendNotificationCommand)
    ]

    if (voteConfirmed) {
      const publishSwitchGroupCommand = new PublishCommand({
        TopicArn: SWITCH_GROUP_TOPIC_ARN,
        Message: JSON.stringify({
          id: bannedid,
          groupid: bannedUser.group
        })
      })

      promises.push(snsClient.send(publishSwitchGroupCommand))
    }

    const batchGetBanNewVotingUsersCommand = new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE_NAME]: {
          Keys: Array.from(group.users).map((id) => ({ id: id })),
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
          action: 'banreply',
          bannedid: bannedid,
          status: voteConfirmed ? 'confirmed' : 'denied'
        }
      })
    })
    promises.push(snsClient.send(publishSendMessageCommand))

    await Promise.allSettled(promises)
  }

  return {
    statusCode: 200
  }
}
