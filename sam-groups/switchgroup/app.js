// NOTE
// It is better to not have MINIMUM_GROUP_SIZE too small.
// Indeed, on concurents return, one can update an old group
// while the other delete it
// keeping the group in the database forever for nothing
// If MINIMUM_GROUP_SIZE is big enough (let say 3), the time window between
// the deactivation of the group (isWaiting = 0) and its deletion should be
// big enough to not have concurrent run trying to update and delete at the same time

// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Switch group
// event.Records[0].Sns.Message
// id : String - user id
// [unused] connectionId : String? - user connection id

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand
} = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

const { v4: uuidv4 } = require('uuid')

// ===== ==== ====
// CONSTANTS
const {
  MINIMUM_GROUP_SIZE_STRING,
  MAXIMUM_GROUP_SIZE_STRING,
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  // SEND_NOTIFICATION_TOPIC_ARN,
  AWS_REGION
} = process.env
const MINIMUM_GROUP_SIZE = parseInt(MINIMUM_GROUP_SIZE_STRING)
const MAXIMUM_GROUP_SIZE = parseInt(MAXIMUM_GROUP_SIZE_STRING)

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`
Receives:
\tRecords[0].Sns.Message:
${event.Records[0].Sns.Message}
`)

  const body = JSON.parse(event.Records[0].Sns.Message)

  const id = body.id

  if (id === undefined) {
    throw new Error('id must be defined')
  }

  // get user
  const getUserCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    ProjectionExpression: '#id, #group, #connectionId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#group': 'group',
      '#connectionId': 'connectionId'
    }
  })
  const user = await dynamoDBDocumentClient.send(getUserCommand).then((response) => (response.Item))
  console.log('user:', user)

  if (user === undefined) {
    console.log(`user <${id}> doesn't exist`)
    return {
      statusCode: 204
    }
  }

  // query a new group (query doesn't work without a KeyConditionExpression, use scan instead)
  // TODO: use a sort index to query only the waiting ones faster
  const queryCommand = new ScanCommand({
    TableName: GROUPS_TABLE_NAME,
    ProjectionExpression: '#id, #users, #isWaiting',
    FilterExpression: '#isWaiting = :true',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users',
      '#isWaiting': 'isWaiting'
    },
    ExpressionAttributeValues: {
      ':true': 1
    }
  })
  const newGroup = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    if (response.Count > 0) {
      for (const group of response.Items) {
        if (group.id !== user.group) {
          return group
        }
      }
    }
    return {
      id: uuidv4(),
      isWaiting: 1, // true
      users: new Set()
    }
  })
  newGroup.users.add(id) // simulate add user id (will be added -for real- below)
  console.log(`put user <${id}> in group <${newGroup.id}>`)

  // update user
  const updateUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    UpdateExpression: `
    SET #group = :groupid
    REMOVE #unreadData, #banConfirmedUsers, #banVotingUsers, #confirmationRequired
    `,
    ExpressionAttributeNames: {
      '#group': 'group',
      '#unreadData': 'unreadData',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#banVotingUsers': 'banVotingUsers',
      '#confirmationRequired': 'confirmationRequired'
    },
    ExpressionAttributeValues: {
      ':groupid': newGroup.id
    }
  })
  const promises = [dynamoDBDocumentClient.send(updateUserCommand).then((response) => (response.Attributes))]

  // update new group
  if (newGroup.users.size >= MINIMUM_GROUP_SIZE) {
    // alert user(s)
    const users = [{ id, connectionId: user.connectionId }]
    if (newGroup.users.size === MINIMUM_GROUP_SIZE && MINIMUM_GROUP_SIZE > 1) {
      // happens only once when group becomes active for the first time
      newGroup.users.delete(id) // remove id, already fetched
      const batchGetOtherUsers = new BatchGetCommand({
        RequestItems: {
          [USERS_TABLE_NAME]: {
            Keys: Array.from(newGroup.users).map((id) => ({ id: id })),
            ProjectionExpression: '#id, #connectionId',
            ExpressionAttributeNames: {
              '#id': 'id',
              '#connectionId': 'connectionId'
            }
          }
        }
      })
      newGroup.users.add(id)

      const otherUsers = await dynamoDBDocumentClient.send(batchGetOtherUsers).then((response) => (response.Responses[USERS_TABLE_NAME]))
      for (const otherUser of otherUsers) {
        users.push(otherUser)
      }
    }
    console.log(`Alert early group users <${newGroup.id}>:`, users)
    const publishSendMessageCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: users,
        message: {
          action: 'switchgroup',
          groupid: newGroup.id
        }
      })
    })

    promises.push(snsClient.send(publishSendMessageCommand))
  }
  if (newGroup.users.size >= MAXIMUM_GROUP_SIZE) {
    newGroup.isWaiting = 0 // false
  }

  const updateNewGroupCommand = new UpdateCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: newGroup.id },
    UpdateExpression: `
    SET #isWaiting = :isWaiting
    ADD #users :id
    `,
    ExpressionAttributeNames: {
      '#isWaiting': 'isWaiting',
      '#users': 'users'
    },
    ExpressionAttributeValues: {
      ':id': new Set([id]),
      ':isWaiting': newGroup.isWaiting
    }
  })
  promises.push(dynamoDBDocumentClient.send(updateNewGroupCommand))

  // update old group (if any)
  if (user.group !== undefined) {
    // get old group (need to count its users)
    const getOldGroupCommand = new GetCommand({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: user.group },
      ProjectionExpression: '#id, #users, #isWaiting',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#users': 'users',
        '#isWaiting': 'isWaiting'
      }
    })
    const oldGroup = await dynamoDBDocumentClient.send(getOldGroupCommand).then((response) => (response.Item))

    // check oldGroup still exists (if concurrent runs)
    if (oldGroup !== undefined) {
      oldGroup.users = oldGroup.users ?? new Set()
      oldGroup.users.delete(id) // simulate remove user id (will be removed -for real- below)

      // NOTE: don't use if/else because both can be triggered (isWaiting to 0 will prevail)
      if (oldGroup.users.size < MAXIMUM_GROUP_SIZE) {
        oldGroup.isWaiting = 1 // true
      }
      if (oldGroup.users.size < MINIMUM_GROUP_SIZE) {
        // NOTE: if an user leave a group it hasn't entered yet it will close it forever
        // for exemple, user A join group ABC, group.users = { A }, group.isWaiting = 1
        // user B join group ABD, group.users = { A, B }, group.isWaiting = 1
        // user A switches group, group.users = { B } group.size < MINIMUM_GROUP_SIZE(3), group.isWaiting = 0
        // group ABC will be closed before ever being opened
        // TODO: cannot switch while waiting (cannot double-click on switch button)
        oldGroup.isWaiting = 0 // false
      }
      if (oldGroup.users.size > 0) {
        // update group
        const updateOldGroupCommand = new UpdateCommand({
          TableName: GROUPS_TABLE_NAME,
          Key: { id: user.group },
          UpdateExpression: `
          SET #isWaiting = :isWaiting
          DELETE #users :id
          `,
          ExpressionAttributeNames: {
            '#isWaiting': 'isWaiting',
            '#users': 'users'
          },
          ExpressionAttributeValues: {
            ':id': new Set([id]),
            ':isWaiting': oldGroup.isWaiting ?? 1 // isWaiting or true
          }
        })
        promises.push(dynamoDBDocumentClient.send(updateOldGroupCommand))
      } else {
        // delete group
        const deleteOldGroupCommand = new DeleteCommand({
          TableName: GROUPS_TABLE_NAME,
          Key: { id: user.group }
        })
        promises.push(dynamoDBDocumentClient.send(deleteOldGroupCommand))
        console.log(`Delete old group <${user.group}>`)
      }
    }
  }

  await Promise.allSettled(promises)
}
