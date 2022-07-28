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

// CHOOSE GROUP LOGIC
// the logic is as easy as possible but hasn't been statically tested, IT NEEDS TO BE.
// We must check that answers indeed have a greater impact on group than order of arrival.
// If not that means that we are still quite randomly assigning groups.
// ----- ----- -----
// We could add ENV VARIABLE for more fine grained controls.
// For exemple, we could decide to create a new group, no matter what, if the maximum of similarity is smaller than a given value.
// ----- ----- -----
// We may want to shuffle the order in which we loop through the groups to have different result
// on each run, for different user
// (there is NO order in the Query, it is "first found first returned")
// (however, getting that the query is simlar, we could imagine that the processed time will be similar for each item too)
// (thus, the order being similar too)

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
  const questions = body.questions ?? {}
  const blockedUsers = body.blockedUsers ?? []
  const isBan = body.isBan ?? false

  if (typeof id === 'undefined') {
    throw new Error('id must be defined')
  }

  // get user
  const getUserCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id, #group, #hiddenGroup, #connectionId, #firebaseToken',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#group': 'group',
      '#hiddenGroup': 'hiddenGroup',
      '#connectionId': 'connectionId',
      '#firebaseToken': 'firebaseToken'
    }
  })
  const user = await dynamoDBDocumentClient.send(getUserCommand).then((response) => (response.Item))
  console.log('user:', user)
  user.group = user.group ?? user.hiddenGroup // if change group while still waiting

  if (typeof user === 'undefined') {
    console.log(`user <${id}> doesn't exist`)
    return {
      statusCode: 204
    }
  }

  // query a new group (query doesn't work without a KeyConditionExpression, use scan instead)
  // TODO: use a sort index to query only the waiting ones faster, skipcq: JS-0099
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

  const newGroup = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    if (response.Count > 0) {
      let maximumOfSimilarity = -1
      let chosenGroup = null

      /* eslint no-labels: ["error", { "allowLoop": true }] */
      checkGroup: for (const group of response.Items) {
        console.log(`check group ${JSON.stringify(group)}`)
        // Check this group is valid
        if (group.id === user.group) {
          console.log(`group ${group.id} already has ${user.id}`)
          continue
        }

        // Is user banned from group
        group.bannedUsers = group.bannedUsers ?? new Set()
        if (group.bannedUsers.has(user.id)) {
          console.log(`group ${group.id} has banned user ${user.id}`)
          continue
        }

        // Is a blocked user in the group
        for (const blockedUser of blockedUsers) {
          console.log(`check ${blockedUser}`)
          // add blocked user to forbidden user
          group.bannedUsers.add(blockedUser)
          // check blocked user not in group
          if (group.users.has(blockedUser)) {
            console.log(`group ${group.id} has blocked user ${blockedUser}`)
            continue checkGroup
          }
        }

        let similarity = 0
        // iterate accross the smallest
        const groupQuestions = group.questions ?? {}
        if (groupQuestions.size < questions.size) {
          for (const [key, value] of Object.entries(groupQuestions)) {
            if (questions[key] === value) {
              similarity += 1
            }
          }
        } else {
          for (const [key, value] of Object.entries(questions)) {
            if (groupQuestions[key] === value) {
              similarity += 1
            }
          }
        }
        if (similarity > maximumOfSimilarity) {
          chosenGroup = Object.assign({}, group)
          maximumOfSimilarity = similarity
        }
      }

      if (chosenGroup !== null) {
        console.log(`select group with similarity of ${maximumOfSimilarity}:\n${JSON.stringify(chosenGroup)}`)
        return chosenGroup
      }
    }

    console.log('create a new group')
    return {
      id: uuidv4(),
      isWaiting: 1,
      users: new Set(),
      bannedUsers: new Set(blockedUsers), // add forbidden users
      questions
    }
  })

  const promises = [
    addUserToGroup(user, newGroup),
    removeUserFromGroup(user, isBan)
  ]

  await Promise.allSettled(promises).then((results) => console.log(JSON.stringify(results)))
  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
async function addUserToGroup (user, newGroup) {
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
    // alert user(s)
    // early users are user not notified of the group yet
    const earlyUsers = [user]
    const isFirstTime = newGroup.users.size === MINIMUM_GROUP_SIZE
    const usersIds = Array.from(newGroup.users).filter((id) => (id !== user.id)).map((id) => ({ id }))
    const otherUsers = []

    if (usersIds.length > 0) {
      newGroup.users.delete(user.id) // remove id, already fetched
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
      newGroup.users.add(user.id)

      await dynamoDBDocumentClient.send(batchGetOtherUsers).then((response) => (response.Responses[USERS_TABLE_NAME])).then((users) => {
        for (const u of users) {
          if (isFirstTime) {
            earlyUsers.push(u)
          } else {
            otherUsers.push(u)
          }
        }
      })
    }
    console.log('early users:', earlyUsers)
    console.log('other users:', otherUsers)

    // update early user group
    for (const earlyUser of earlyUsers) {
      const updateEarlyUserCommand = new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: earlyUser.id },
        UpdateExpression: `
        SET #group = :groupid, #hiddenGroup = :groupid
        REMOVE #unreadData, #banConfirmedUsers, #banVotingUsers, #confirmationRequired
        `,
        ExpressionAttributeNames: {
          '#group': 'group',
          '#hiddenGroup': 'hiddenGroup',
          '#unreadData': 'unreadData',
          '#banConfirmedUsers': 'banConfirmedUsers',
          '#banVotingUsers': 'banVotingUsers',
          '#confirmationRequired': 'confirmationRequired'
        },
        ExpressionAttributeValues: {
          ':groupid': newGroup.id
        }
      })
      promises.push(dynamoDBDocumentClient.send(updateEarlyUserCommand).then((response) => (response.Attributes)))
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
          groupid: newGroup.id,
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
  } else {
    // hide group id
    // update user
    const updateUserCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: user.id },
      UpdateExpression: `
    SET #hiddenGroup = :groupid
    REMOVE #group, #unreadData, #banConfirmedUsers, #banVotingUsers, #confirmationRequired
    `,
      ExpressionAttributeNames: {
        '#group': 'group',
        '#hiddenGroup': 'hiddenGroup',
        '#unreadData': 'unreadData',
        '#banConfirmedUsers': 'banConfirmedUsers',
        '#banVotingUsers': 'banVotingUsers',
        '#confirmationRequired': 'confirmationRequired'
      },
      ExpressionAttributeValues: {
        ':groupid': newGroup.id
      }
    })
    promises.push(dynamoDBDocumentClient.send(updateUserCommand).then((response) => (response.Attributes)))
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

  return Promise.allSettled(promises).then(results => (console.log(results)))
}

async function removeUserFromGroup (user, isBan) {
  // Remove user grom its group
  // user : Map
  //    id : String - user id
  //    group : String - user group id
  //    connectionId : String - user connection id
  //    firebaseToken : String - user firebase token

  if (typeof user.group === 'undefined') {
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

  // retreive group (needed to count its users)
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.group },
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
      if (isBan) {
        expressionAttributeNames['#bannedUsers'] = 'bannedUsers'
      }
      const updateGroupCommand = new UpdateCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: user.group },
        UpdateExpression: `
        ${isBan ? 'ADD #bannedUsers :id' : ''}
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
        Key: { id: user.group }
      })
      promises.push(dynamoDBDocumentClient.send(deleteGroupCommand))
      console.log(`Delete old group <${user.group}>`)
    }

    // send message to group users to notify user has leaved the group (including itself)
    const publishSendMessageCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users,
        message: {
          action: 'leavegroup',
          groupid: user.group,
          id: user.id
        }
      })
    })
    promises.push(snsClient.send(publishSendMessageCommand))

    // NOTE: can send notification too
    return Promise.allSettled(promises)
  }
  return Promise.resolve()
}
