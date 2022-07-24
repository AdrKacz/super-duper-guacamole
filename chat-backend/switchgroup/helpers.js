// ===== ==== ====
// IMPORTS
const {
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand
} = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  MINIMUM_GROUP_SIZE_STRING,
  MAXIMUM_GROUP_SIZE_STRING,
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  SEND_NOTIFICATION_TOPIC_ARN
} = process.env

const MINIMUM_GROUP_SIZE = parseInt(MINIMUM_GROUP_SIZE_STRING, 10)
const MAXIMUM_GROUP_SIZE = parseInt(MAXIMUM_GROUP_SIZE_STRING, 10)

// ===== ==== ====
// EXPORTS
exports.addUserToGroup = async (user, newGroup) => {
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

  // update user
  const updateUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: user.id },
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
    // early users are user not notified of the group yet
    const earlyUsers = [user]
    const isFirstTime = newGroup.users.size === MINIMUM_GROUP_SIZE
    const usersIds = Array.from(newGroup.users).filter((id) => (id !== user.id)).map((id) => ({ id }))
    const otherUsers = []
    // happens only once when group becomes active for the first time
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

exports.removeUserFromGroup = async (user, isBan) => {
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
