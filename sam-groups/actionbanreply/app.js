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
// bannedid : String - banned user id
// status : String - 'confirmed' or 'denied'

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
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
\tRequest Context:\n${JSON.stringify(event.requestContext)}
\tEnvironment:\n${JSON.stringify(process.env)}
`)

  const body = JSON.parse(event.body)

  const id = body.id
  const bannedid = body.bannedid
  const status = body.status

  if (id === undefined || bannedid === undefined || !['confirmed', 'denied'].includes(status)) {
    throw new Error("id and bannedid must be defined, and status must be either 'confirmed' or 'denied'")
  }

  // get users
  const userPromise = dynamoDBDocumentClient.send(new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    ProjectionExpression: '#id, #group, #connectionId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#group': 'group',
      '#connectionId': 'connectionId'
    }
  })).then((data) => (data.Item))

  const banneduserPromise = dynamoDBDocumentClient.send(new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: bannedid },
    ProjectionExpression: '#id, #group, #connectionId, #banVotingUsers, #confirmationRequired',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#group': 'group',
      '#connectionId': 'connectionId',
      '#banVotingUsers': 'banVotingUsers',
      '#confirmationRequired': 'confirmationRequired'
    }
  })).then((data) => (data.Item))

  const [user, banneduser] = await Promise.all([userPromise, banneduserPromise])

  // verify both user and their group (must be the same)
  console.log(`Response for user <${id}>:
    ${JSON.stringify(user)}`)
  if (user === undefined || user.connectionId === undefined || user.group === undefined) {
    throw new Error(`user <${id}> is not defined or has no connectionId or had no group`)
  }

  if (user.connectionId !== event.requestContext.connectionId) {
    throw new Error(`user <${id}> has connectionId <${user.connectionId}> but sent request via connectionId <${event.requestContext.connectionId}>`)
  }

  console.log(`Response for banned user <${bannedid}> (banVotingUsers below):
    ${JSON.stringify(banneduser)}`)
  console.log(banneduser.banVotingUsers)
  if (banneduser === undefined || banneduser.group !== user.group) {
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // don't throw an error
    // TODO: warn user banned user is not in group anymore
    console.log(`banned user <${bannedid}> is not defined or banned user and user are not in the same group`)
    return {
      statusCode: 403
    }
  }

  const banVotingUsers = banneduser.banVotingUsers ?? new Set()

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
  // banVotingUsers is not empty, so confirmationRequired is defined

  // update banned user
  const dynamicExpressionAttributeNames = {
    '#banVotingUsers': 'banVotingUsers'
  }
  if (status === 'confirmed') {
    dynamicExpressionAttributeNames['#banConfirmedUsers'] = 'banConfirmedUsers'
  }
  const updatedBanneduser = await dynamoDBDocumentClient.send(new UpdateCommand({
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
  })).then((data) => (data.Attributes))
  console.log(`Update user <${bannedid}> with (new) values:
${JSON.stringify(updatedBanneduser)}`)
  const updatedBanConfirmerUsers = updatedBanneduser?.banConfirmedUsers ?? new Set()
  const updatedBanVotingUsers = updatedBanneduser?.banVotingUsers ?? new Set()

  const voteConfirmed = updatedBanConfirmerUsers.size >= banneduser.confirmationRequired
  const voteDenied = updatedBanConfirmerUsers.size + updatedBanVotingUsers.size < banneduser.confirmationRequired

  // NOTE: here we inform all the group - even the user aimed by the vote - of the result
  if (voteConfirmed || voteDenied) {
    // close the vote
    const removeBannedFromVotePromise = dynamoDBDocumentClient.send(new UpdateCommand({
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
    }))

    const publishNotificationPromise = snsClient.send(new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        topic: `group-${banneduser.group}`,
        notification: {
          title: 'Le vote est terminé 🗳',
          body: 'Viens voir le résultat !'
        }
      })
    }))

    const publishMessagePromise = snsClient.send(new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        groups: [banneduser.group],
        message: {
          action: 'banreply',
          bannedid: bannedid,
          status: voteConfirmed ? 'confirmed' : 'denied'
        }
      })
    }))

    await Promise.allSettled([removeBannedFromVotePromise, publishNotificationPromise, publishMessagePromise])

    if (voteConfirmed) {
      // switch group for banned user
      await snsClient.send(new PublishCommand({
        TopicArn: SWITCH_GROUP_TOPIC_ARN,
        Message: JSON.stringify({
          user: {
            id: bannedid,
            groupid: banneduser.group,
            connectionId: banneduser.connectionId
          }
        })
      }))
    }
  }

  return {
    statusCode: 200
  }
}
