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
// questions : Map<String, String>?
//    question id <String> - answer id <String>
// blockedUsers : List<String>?
//    blockedUser userId
// isBan : Bool? - is user banned from its old group (false by default)

// ===== ==== ====
// NOTE
// MINIMUM_GROUP_SIZE
// It is better to not have MINIMUM_GROUP_SIZE too small.
// Indeed, on concurents return, one can update an old group
// while the other delete it
// keeping the group in the database forever for nothing
// If MINIMUM_GROUP_SIZE is big enough (let say 3), the time window between
// the deactivation of the group (isWaiting = false) and its deletion should be
// big enough to not have concurrent run trying to update and delete at the same time

// IS_WAINTING ENCODING
// I cannot use a BOOL key, BOOL cannot be used as Index
// Instead I used a N key.
// 1 is true and 0 is false

// BAN
// On a ban, BAN_FUNCTION doesn't send user questions because they are not stored.
// For now, I just considered a banned user as an user who hasn't answer any question.

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const {
  DynamoDBDocumentClient,
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand
} = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { v4: uuidv4 } = require('uuid')

// ===== ==== ====
// CONSTANTS
const {
  MINIMUM_GROUP_SIZE_STRING,
  MAXIMUM_GROUP_SIZE_STRING,
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  GROUPS_WAINTING_ID_INDEX_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN,
  AWS_REGION
} = process.env
const MINIMUM_GROUP_SIZE = parseInt(MINIMUM_GROUP_SIZE_STRING, 10)
const MAXIMUM_GROUP_SIZE = parseInt(MAXIMUM_GROUP_SIZE_STRING, 10)

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

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

  if (typeof id === 'undefined') {
    throw new Error('id must be defined')
  }

  // get user
  const getUserCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id, #groupId, #hiddenGroup, #connectionId, #firebaseToken',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#groupId': 'groupId',
      '#hiddenGroup': 'hiddenGroup',
      '#connectionId': 'connectionId',
      '#firebaseToken': 'firebaseToken'
    }
  })
  const user = await dynamoDBDocumentClient.send(getUserCommand).then((response) => (response.Item))
  console.log('user:', user)

  if (typeof user === 'undefined') {
    console.log(`user <${id}> doesn't exist`)
    return {
      statusCode: 204
    }
  }

  // re-populate user to prepare processing
  user.groupId = user.groupId ?? user.hiddenGroup // if change group while still waiting
  user.questions = body.questions ?? {}
  user.blockedUsersSet = new Set(body.blockedUsers ?? [])
  user.isBan = body.isBan ?? false

  const promises = [
    findGroupToUser(user).then(
      (newGroup) => (addUserToGroup(user, newGroup))
    ),
    removeUserFromGroup(user)
  ]

  await Promise.allSettled(promises).then(results => (console.log(`main - ${JSON.stringify(results)}`)))
  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS

/**
 * Returns a new group for user.
 *
 * @param {Object} user
 * @param {string} user.id - id
 * @param {string?} [user.groupId] - current group id
 * @param {Set.<string>} [user.blockedUsersSet] - blocked user ids
 * @param {Object} [user.questions] - answers to the questions
 *
 * @return {Promise<{id: string, users: ?Set.<string>, bannedUsers: ?Set.<string>, isOpen: ?boolean, isWaiting: ?number, questions: ?Object.<string, string>}>}
 *
 * user send the answer to its question, along with marker to note discriminating questions
 * other users in the group must have the exact same answer to discriminating questions
 * other users in the group will have as many same answers as possible for none discriminating questions
 *
 * discriminating questions ids start with "_"
 */
async function findGroupToUser (user) {
  // set default value
  user.blockedUsersSet = user.blockedUsersSet ?? new Set()
  user.questions = user.questions ?? {}

  // get available group
  const queryCommand = new QueryCommand({
    TableName: GROUPS_TABLE_NAME,
    IndexName: GROUPS_WAINTING_ID_INDEX_NAME,
    KeyConditionExpression: '#isWaiting = :true',
    ExpressionAttributeNames: {
      '#isWaiting': 'isWaiting'
    },
    ExpressionAttributeValues: {
      ':true': 1
    }
  })

  const queryResponse = await dynamoDBDocumentClient.send(queryCommand)
  console.log(`query groups ${JSON.stringify(queryResponse)}`)

  let maximumOfSimilarity = -1
  let chosenGroup = null

  for (const group of queryResponse.Items) {
    console.log(`check group ${JSON.stringify(group)}`)
    console.log('with users')
    console.log(group.users)
    // add blocked users to banned users
    group.bannedUsers = group.bannedUsers ?? new Set()
    for (const blockedUser of user.blockedUsersSet) {
      group.bannedUsers.add(blockedUser)
    }
    // default question
    group.questions = group.questions ?? {}
    console.log('populated group')
    console.log(group)

    if (!isGroupValid(user, group)) {
      console.log(`group ${group.id} not valid for user ${JSON.stringify(user)}`)
      continue
    }
    console.log(`group ${group.id} is valid`)

    let similarity = 0
    for (const [question, answer] of Object.entries(user.questions)) {
      if (answer === group.questions[question]) {
        similarity += 1
      }
    }

    if (similarity > maximumOfSimilarity) {
      chosenGroup = Object.assign({}, group)
      maximumOfSimilarity = similarity
    }
  }

  if (chosenGroup !== null) {
    console.log(`chose group with similarity of ${maximumOfSimilarity}:\n${JSON.stringify(chosenGroup)}`)
    console.log('user questions were:')
    console.log(user.questions)
    console.log('group questions were:')
    console.log(chosenGroup.questions)
    return chosenGroup
  }

  console.log('create new group')
  return {
    id: uuidv4(),
    isWaiting: 1,
    users: new Set(),
    bannedUsers: new Set(user.blockedUsersSet), // add forbidden users
    questions: Object.assign({}, user.questions)
  }
}

function isGroupValid (user, group) {
  // Check this group is valid
  if (group.id === user.groupId) {
    console.log(`group ${group.id} already has ${user.id}`)
    return false
  }

  // Is user banned from group
  group.bannedUsers = group.bannedUsers ?? new Set()
  if (group.bannedUsers.has(user.id)) {
    console.log(`group ${group.id} has banned user ${user.id}`)
    return false
  }

  // Is an user in the updated group banned users
  for (const groupUser of group.users) {
    if (group.bannedUsers.has(groupUser)) {
      console.log(`group ${group.id} has blocked user ${groupUser}`)
      return false
    }
  }

  // Are discriminating questions the same
  for (const [question, answer] of Object.entries(user.questions)) {
    // check discriminating questions
    if (answer.startsWith('_') && answer !== group.questions[question]) {
      // group is not valid
      return false
    }
  }

  for (const [question, answer] of Object.entries(group.questions)) {
    // check discriminating questions
    if (answer.startsWith('_') && answer !== user.questions[question]) {
      // group is not valid
      return false
    }
  }

  return true
}

function addUserToGroup (user, newGroup) {
  // Add user to a new group
  // user : Map
  //    id : String - user id
  //    group : String - user group id
  //    connectionId : String - user connection id
  //    firebaseToken : String - user firebase token
  // newGroup : Map - new user group
  //    id : String - group id
  //    users : List<String> - group users ids
  //    isWaiting : Int - 1 if is waiting for other users, else 0
  //    question: Map<String, String>
  //    bannedUsers: Set<String>

  newGroup.users.add(user.id) // simulate add user id (will be added -for real- below)
  console.log(`put user <${user.id}> in group ${JSON.stringify(newGroup)}`)

  const promises = []

  // update new group
  if (newGroup.users.size >= MINIMUM_GROUP_SIZE) {
    promises.push(updateOpenedGroup(user, newGroup))
  } else {
    // hide group id
    // update user
    const updateUserCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: user.id },
      UpdateExpression: `
      SET #hiddenGroup = :groupId
      REMOVE #groupId, #unreadData, #banConfirmedUsers, #banVotingUsers, #confirmationRequired
      `,
      ExpressionAttributeNames: {
        '#groupId': 'groupId',
        '#hiddenGroup': 'hiddenGroup',
        '#unreadData': 'unreadData',
        '#banConfirmedUsers': 'banConfirmedUsers',
        '#banVotingUsers': 'banVotingUsers',
        '#confirmationRequired': 'confirmationRequired'
      },
      ExpressionAttributeValues: {
        ':groupId': newGroup.id
      }
    })
    promises.push(dynamoDBDocumentClient.send(updateUserCommand))
  }

  if (newGroup.users.size >= MAXIMUM_GROUP_SIZE) {
    newGroup.isWaiting = 0 // false
  }

  const expressionAttributeNames = {
    '#isWaiting': 'isWaiting',
    '#questions': 'questions',
    '#users': 'users'
  }
  const expressionAttributeValues = {
    ':id': new Set([user.id]),
    ':isWaiting': newGroup.isWaiting,
    ':questions': newGroup.questions
  }

  if (newGroup.bannedUsers.size > 0) {
    expressionAttributeNames['#bannedUsers'] = 'bannedUsers'
    expressionAttributeValues[':bannedUsers'] = newGroup.bannedUsers
  }

  const updateNewGroupCommand = new UpdateCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: newGroup.id },
    UpdateExpression: `
    SET #isWaiting = :isWaiting, #questions = :questions
    ADD #users :id${newGroup.bannedUsers.size > 0 ? ' ,#bannedUsers :bannedUsers' : ''}
    `,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  })
  promises.push(dynamoDBDocumentClient.send(updateNewGroupCommand).then((response) => (response.Attributes)))

  return Promise.allSettled(promises).then(results => (console.log(`addUserToGroup - ${JSON.stringify(results)}`)))
}

async function updateOpenedGroup (user, group) {
  // alert user(s)
  // early users are user not notified of the group yet
  const earlyUsers = [user]
  const isFirstTime = group.users.size === MINIMUM_GROUP_SIZE
  const usersIds = Array.from(group.users).filter((id) => (id !== user.id)).map((id) => ({ id }))
  const otherUsers = []

  const promises = []

  if (usersIds.length > 0) {
    const batchGetOtherUsers = new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE_NAME]: {
          Keys: usersIds,
          ProjectionExpression: '#id, #connectionId, #firebaseToken',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#connectionId': 'connectionId',
            '#firebaseToken': 'firebaseToken'
          }
        }
      }
    })

    const batchGetOtherUsersResponse = await dynamoDBDocumentClient.send(batchGetOtherUsers)
    if (isFirstTime) {
      earlyUsers.push(...batchGetOtherUsersResponse.Responses[USERS_TABLE_NAME])
    } else {
      otherUsers.push(...batchGetOtherUsersResponse.Responses[USERS_TABLE_NAME])
    }
  }
  console.log('early users:', earlyUsers)
  console.log('other users:', otherUsers)

  // update early user group
  for (const earlyUser of earlyUsers) {
    const updateEarlyUserCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: earlyUser.id },
      UpdateExpression: `
        SET #groupId = :groupId, #hiddenGroup = :groupId
        REMOVE #unreadData, #banConfirmedUsers, #banVotingUsers, #confirmationRequired
        `,
      ExpressionAttributeNames: {
        '#groupId': 'groupId',
        '#hiddenGroup': 'hiddenGroup',
        '#unreadData': 'unreadData',
        '#banConfirmedUsers': 'banConfirmedUsers',
        '#banVotingUsers': 'banVotingUsers',
        '#confirmationRequired': 'confirmationRequired'
      },
      ExpressionAttributeValues: {
        ':groupId': group.id
      }
    })
    promises.push(dynamoDBDocumentClient.send(updateEarlyUserCommand))
  }

  const allUsers = earlyUsers.concat(otherUsers)
  const allUsersMap = {}
  allUsers.forEach((loopUser) => {
    allUsersMap[loopUser.id] = {
      id: loopUser.id,
      isActive: typeof loopUser.connectionId !== 'undefined'
    }
  })
  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: allUsers,
      message: {
        action: 'joingroup',
        groupid: group.id,
        users: allUsersMap
      }
    })
  })
  promises.push(snsClient.send(publishSendMessageCommand))

  const publishEarlyUsersSendNotificationCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      users: earlyUsers,
      notification: {
        title: 'Viens te présenter 🥳',
        body: 'Je viens de te trouver un groupe !'
      }
    })
  })
  promises.push(snsClient.send(publishEarlyUsersSendNotificationCommand))

  if (otherUsers.length > 0) {
    const publishOtherUsersNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: otherUsers,
        notification: {
          title: "Y'a du nouveaux 🥳",
          body: "Quelqu'un arrive dans le groupe !"
        }
      })
    })
    promises.push(snsClient.send(publishOtherUsersNotificationCommand))
  }

  return Promise.allSettled(promises).then(results => (console.log(`updateOpenedGroup - ${JSON.stringify(results)}`)))
}

async function removeUserFromGroup (user) {
  // set default value
  user.isBan = user.isBan ?? false

  // Remove user grom its group
  // user : Map
  //    id : String - user id
  //    groupId : String - user group id
  //    connectionId : String - user connection id
  //    firebaseToken : String - user firebase token
  console.log(`remove user ${JSON.stringify(user)}`)
  if (typeof user.groupId === 'undefined' || user.groupId === '') {
    const publishSendMessageCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: [user],
        message: {
          action: 'leavegroup',
          id: user.id
        }
      })
    })
    return snsClient.send(publishSendMessageCommand) // no group so no need to update it, simply warn user
  }
  console.log(`user is in group ${user.groupId}, ${typeof user.groupId}`)
  // retreive group (needed to count its users)
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.groupId },
    ProjectionExpression: '#id, #users, #isWaiting',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users',
      '#isWaiting': 'isWaiting'
    }
  })
  const group = await dynamoDBDocumentClient.send(getGroupCommand).then((response) => (response.Item))

  // check oldGroup still exists (if concurrent runs)
  // to avoid re-create it throught the update
  if (typeof group !== 'undefined') {
    group.users = group.users ?? new Set()
    group.users.delete(user.id) // simulate remove user id (will be removed -for real- below)

    // NOTE: don't use if/else because both can be triggered (isWaiting to 0 will prevail)
    if (group.users.size < MAXIMUM_GROUP_SIZE) {
      group.isWaiting = 1 // true
    }
    if (group.users.size < MINIMUM_GROUP_SIZE) {
      // NOTE: if an user leave a group it hasn't entered yet it will close it forever
      // for exemple, user A join group C, group.users = { A }, group.isWaiting = true
      // user B join group C, group.users = { A, B }, group.isWaiting = true
      // user A switches group, group.users = { B } group.size < MINIMUM_GROUP_SIZE(3), group.isWaiting = false
      // group C will be closed before ever being opened
      group.isWaiting = 0 // false
    }

    // update or delete group
    const promises = []
    const users = [user]
    if (group.users.size > 0) {
      // update group (add to bannedUsers if isBan)
      const expressionAttributeNames = {
        '#isWaiting': 'isWaiting',
        '#users': 'users'
      }
      if (user.isBan) {
        expressionAttributeNames['#bannedUsers'] = 'bannedUsers'
      }
      const updateGroupCommand = new UpdateCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: user.groupId },
        UpdateExpression: `
        ${user.isBan ? 'ADD #bannedUsers :id' : ''}
        SET #isWaiting = :isWaiting
        DELETE #users :id
        `,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: {
          ':id': new Set([user.id]),
          ':isWaiting': group.isWaiting ?? 1 // true
        }
      })
      promises.push(dynamoDBDocumentClient.send(updateGroupCommand))

      // retrieve user all to warn them
      const batchGetUsersCommand = new BatchGetCommand({
        RequestItems: {
          [USERS_TABLE_NAME]: {
            Keys: Array.from(group.users).map((id) => ({ id })),
            ProjectionExpression: '#id, #connectionId, #firebaseToken',
            ExpressionAttributeNames: {
              '#id': 'id',
              '#connectionId': 'connectionId',
              '#firebaseToken': 'firebaseToken'
            }
          }
        }
      })
      const otherUsers = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))
      users.push(...otherUsers)
    } else {
      // delete group
      const deleteGroupCommand = new DeleteCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: user.groupId }
      })
      promises.push(dynamoDBDocumentClient.send(deleteGroupCommand))
      console.log(`Delete old group <${user.groupId}>`)
    }

    // send message to group users to notify user has leaved the group (including itself)
    const publishSendMessageCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users,
        message: {
          action: 'leavegroup',
          groupid: user.groupId,
          id: user.id
        }
      })
    })
    promises.push(snsClient.send(publishSendMessageCommand))

    // NOTE: can send notification too
    return Promise.allSettled(promises).then(results => (console.log(`removeUserFromGroup - ${JSON.stringify(results)}`)))
  }
  return Promise.resolve()
}
