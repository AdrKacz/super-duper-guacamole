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
// messageid : String - message id being banned for (to be removed)

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

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
\tRequest Context:\n${JSON.stringify(event.requestContext)}
\tEnvironment:\n${JSON.stringify(process.env)}
`)

  const body = JSON.parse(event.body)

  const id = body.id
  const bannedid = body.bannedid
  const messageid = body.messageid

  if (id === undefined || bannedid === undefined || messageid === undefined) {
    throw new Error('id, bannedid, and messageid must be defined')
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
    ProjectionExpression: '#id, #group, #connectionId, #banVotingUsers, #banConfirmedUsers',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#group': 'group',
      '#connectionId': 'connectionId',
      '#banVotingUsers': 'banVotingUsers',
      '#banConfirmedUsers': 'banConfirmedUsers'
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

  console.log(`Response for banned user <${bannedid}> (banVotingUsers then banConfirmedUsers below):
${JSON.stringify(banneduser)}`)
  console.log(banneduser.banVotingUsers)
  console.log(banneduser.banConfirmedUsers)
  if (banneduser === undefined || banneduser.group !== user.group) {
    // NOTE: it can happens if banned user is banned but not everyone has voted yet (app not updated)
    // Don't throw an error
    // TODO: warn user banned user is not in group anymore
    console.log(`banned user <${bannedid}> is not defined or banned user and user are not in the same group`)
    return {
      statusCode: 403
    }
  }

  const banVotingUsers = banneduser.banVotingUsers ?? new Set()
  const banConfirmedUsers = banneduser.banConfirmedUsers ?? new Set()

  // get users in group to set confirmationRequired
  const groupusers = await dynamoDBDocumentClient.send(new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.group },
    ProjectionExpression: '#users',
    ExpressionAttributeNames: {
      '#users': 'users'
    }
  })).then((data) => (data.Item.users))

  const banNewVotingUsers = new Set(groupusers)
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

  const confirmationRequired = Math.min(CONFIRMATION_REQUIRED, groupusers.size - 1)

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
  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: bannedid },
    UpdateExpression: `
    ${banNewVotingUsers.size > 0 ? 'ADD #banVotingUsers :banNewVotingUsers' : ''}
    SET #confirmationRequired = :confirmationRequired
    `,
    ExpressionAttributeNames: dynamicExpressionAttributeNames,
    ExpressionAttributeValues: dynamicExpressionAttributeValues
  }))

  // publish to sns topics (only if new users)
  if (banNewVotingUsers.size > 0) {
    const publishCommands = [
      // send message
      new PublishCommand({
        TopicArn: SEND_MESSAGE_TOPIC_ARN,
        Message: JSON.stringify({
          users: Array.from(banNewVotingUsers),
          message: {
            action: 'banrequest',
            messageid: messageid
          }
        })
      }),
      // send notification
      new PublishCommand({
        TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
        Message: JSON.stringify({
          topic: `group-${banneduser.group}`,
          notification: {
            title: "Quelqu'un a mal agi ❌",
            body: 'Viens donner ton avis !'
          }
        })
      })
    ]

    await Promise.allSettled(publishCommands.map((publishCommand) => (
      new Promise((resolve, _reject) => {
        snsClient.send(publishCommand)
          .catch((error) => {
            console.log(`Error:
  ${JSON.stringify(error)}
  With command input:
  ${JSON.stringify(publishCommand.input)}`)
          })
          .finally(() => {
            resolve() // resolve anyway
          })
      })
    )))
  }

  return {
    statusCode: 200
  }
}
