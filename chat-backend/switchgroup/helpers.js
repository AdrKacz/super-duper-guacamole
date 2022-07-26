// ===== ==== ====
// IMPORTS
const {
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand
} = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

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
  SEND_NOTIFICATION_TOPIC_ARN
} = process.env

const MINIMUM_GROUP_SIZE = parseInt(MINIMUM_GROUP_SIZE_STRING, 10)
const MAXIMUM_GROUP_SIZE = parseInt(MAXIMUM_GROUP_SIZE_STRING, 10)

// ===== ==== ====
// EXPORTS
/**
 * Remove user from its group.
 * @todo update user and group in parallel
 *
 * @param {Object} user
 * @param {string} user.id - id
 * @param {string} user.group - group id
 */
exports.removeUserFromGroup = async (user) => {
  console.log(`remove user ${user.id} from group ${user.group}`)
  // update user
  const updateUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: user.id },
    UpdateExpression: `
          REMOVE #group, #unreadData, #banConfirmedUsers, #banVotingUsers, #confirmationRequired
          `,
    ExpressionAttributeNames: {
      '#group': 'group',
      '#unreadData': 'unreadData',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#banVotingUsers': 'banVotingUsers',
      '#confirmationRequired': 'confirmationRequired'
    }
  })
  const updateUserPromise = dynamoDBDocumentClient.send(updateUserCommand)

  // update group
  if (typeof user.group === 'undefined') {
    console.log(`user ${user.id} has no group`)
    return updateUserPromise // just wait for user to be updated
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

  if (typeof group === 'undefined') {
    // if group doesn't exist anymore, don't update it
    // you don't want to re-create a record in the database
    console.log(`group ${user.group} is undefined`)
    return updateUserPromise // just wait for user to be updated
  }

  const updateGroupCommand = new UpdateCommand({
    ReturnValues: 'UPDATED_NEW',
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
      ':id': new Set([user.id]),
      ':isWaiting': 1 // true
    }
  })
  const updatedGroup = await dynamoDBDocumentClient.send(updateGroupCommand).then((response) => (response.Attributes))

  updatedGroup.users = updatedGroup.users ?? new Set()

  if (updatedGroup.users.size > 0) {
    console.log(`inform group ${user.group} of its new user`)
    const groupUsers = Array.from(updatedGroup.users)
    // inform group
    const publishCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: groupUsers,
        message: {
          action: 'register',
          unreadData: [],
          group: group.id,
          groupUsers: groupUsers.map(({ id, connectionId }) => ({ id, isOnline: typeof connectionId !== 'undefined' }))
        }
      })
    })

    // inform group - old way
    const publishOldCommand = new PublishCommand({
      TopicArn: SEND_MESSAGE_TOPIC_ARN,
      Message: JSON.stringify({
        users: groupUsers.concat(user.id),
        message: {
          action: 'leavegroup',
          groupid: group.id,
          id: user.id
        }
      })
    })

    return Promise.all([
      updateUserPromise,
      snsClient.send(publishCommand),
      snsClient.send(publishOldCommand)
    ])
  }

  // there is no more user in the group, delete it
  // NOTE - concurrent runs
  // two concurrents update, one removing a user and one adding a user
  //    to the same group can results in unexpected behaviour
  // your group could be temporary empty, so you will delete it
  // the added user will be in a no-mans-land
  //    and will ask for a new group, that results in longer waiting time

  console.log(`delete group ${user.group}`)
  const deleteGroupCommand = new DeleteCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.group }
  })

  return Promise.all([
    updateUserPromise,
    dynamoDBDocumentClient.send(deleteGroupCommand)
  ])
}

/**
 * Returns a new group for user.
 *
 * @param {Object} user
 * @param {string} user.id - id
 * @param {string} [user.group] - current group id
 *
 * @param {Set.<string>} [blockedUsers] - blocked user ids
 * @param {string[]} [questions] - answers to the questions
 *
 * @return {Promise<{id: string, users: ?Set.<string>, bannedUsers: ?Set.<string>, isOpen: ?boolean, isWaiting: ?number, questions: ?Object.<string, string>}>}
 *
 * the logic is as easy as possible but hasn't been statically tested, IT NEEDS TO BE.
 * We must check that answers indeed have a greater impact on group than order of arrival.
 * If not that means that we are still quite randomly assigning groups.
 *
 * We could add ENV VARIABLE for more fine grained controls.
 * For exemple, we could decide to create a new group, no matter what, if the maximum of similarity is smaller than a given value.
 *
 * We may want to shuffle the order in which we loop through the groups to have different result
 * on each run, for different user
 * (there is NO order in the Query, it is "first found first returned")
 * (however, getting that the query is similar, we could imagine that the processed time will be similar for each item too)
 * (thus, the order being similar too)
 */
exports.findGroupToUser = async (user, blockedUsers, questions) => {
  // set default value
  if (typeof user.group === 'undefined') {
    user.group = ''
  }

  if (typeof blockedUsers === 'undefined') {
    blockedUsers = new Set()
  }

  if (typeof questions === 'undefined') {
    questions = []
  }

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
    const isValid = isGroupValid(user, group, blockedUsers)
    if (!isValid.isValid) {
      console.log(isValid.message)
      continue
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
    // update banned user
    for (const blockedUser of blockedUsers) {
      console.log(`check ${blockedUser}`)
      // add blocked user to forbidden user
      chosenGroup.bannedUsers.add(blockedUser)
    }
    console.log(`chose group ${JSON.stringify(chosenGroup)}`)
    return chosenGroup
  } else {
    console.log('create new group')
    return {
      id: uuidv4(),
      bannedUsers: blockedUsers,
      questions
    }
  }
}

/**
 * Add user to group.
 *
 * @param {Object} user
 * @param {string} user.id - id
 * @param {string} user.group - group id
 *
 * @param {Object} group - new group
 * @param {string} group.id - id
 * @param {Set.<string>} [group.users] - user ids
 * @param {Set.<string>} [group.bannedUsers] - banned user ids
 * @param {boolean} [group.isOpen=false]
 * @param {number} [group.isWaiting=1] - 1 if is not full, else 0
 * @param {Object.<string, string>} [group.questions]
 */
exports.addUserToGroup = async (user, group) => {
  // set default value
  if (typeof group.isOpen === 'undefined') {
    group.isOpen = false
  }

  if (typeof group.isWaiting === 'undefined') {
    group.isWaiting = 1
  }

  if (typeof group.users === 'undefined') {
    group.users = new Set()
  }

  if (typeof group.bannedUsers === 'undefined') {
    group.bannedUsers = new Set()
  }

  if (typeof group.questions === 'undefined') {
    group.questions = {}
  }

  // process
  if (!group.isOpen && group.users.size >= MINIMUM_GROUP_SIZE - 1) {
    console.log(`open group ${group.id}`)
    group.isOpen = true // open group
  }

  if (group.users.size >= MAXIMUM_GROUP_SIZE - 1) {
    console.log(`group ${group.id} is full`)
    group.isWaiting = 0 // false
  }

  const updateGroupCommand = new UpdateCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: group.id },
    UpdateExpression: `
          SET #isWaiting = :isWaiting, #questions = :questions, #isOpen = :isOpen
          ADD #users :id
          `,
    ExpressionAttributeNames: {
      '#isWaiting': 'isWaiting',
      '#questions': 'questions',
      '#isOpen': 'isOpen',
      '#users': 'users'
    },
    ExpressionAttributeValues: {
      ':id': new Set([user.id]),
      ':isWaiting': group.isWaiting,
      ':questions': group.questions,
      ':isOpen': group.isOpen
    }
  })

  const updateGroupCommandPromise = dynamoDBDocumentClient.send(updateGroupCommand)

  if (!group.isOpen) {
    console.log(`group ${group.id} is not open`)
    return
  }

  // get all users
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: group.users,
        ProjectionExpression: '#id, #group, #connectionId, #firebaseToken',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#group': 'group',
          '#connectionId': 'connectionId',
          '#firebaseToken': 'firebaseToken'
        }
      }
    }
  })

  const groupUsers = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

  const usersInGroup = []
  const usersNotInGroup = []
  for (const groupUser of groupUsers) {
    if (groupUser.group === group.id) {
      usersInGroup.push(user)
    } else {
      usersNotInGroup.push(user)
    }
  }

  // inform group
  const publishCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: groupUsers,
      message: {
        action: 'register',
        unreadData: [],
        group: group.id,
        groupUsers: groupUsers.map(({ id, connectionId }) => ({ id, isOnline: typeof connectionId !== 'undefined' }))
      }
    })
  })

  // inform group - old way
  const groupUsersMap = {}
  groupUsers.forEach((loopUser) => {
    groupUsersMap[loopUser.id] = {
      id: loopUser.id,
      isActive: typeof loopUser.connectionId !== 'undefined'
    }
  })
  const publishOldCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: groupUsers,
      message: {
        action: 'joingroup',
        groupid: group.id,
        users: groupUsersMap
      }
    })
  })

  return Promise.all([
    updateGroupCommandPromise,
    snsClient.send(publishCommand),
    snsClient.send(publishOldCommand),
    handleUsersInGroup(usersInGroup),
    handlerUsersNotInGroup(usersNotInGroup)
  ])
}

// ===== ==== ====
// HELPERS
function handleUsersInGroup (users) {
  if (users.length === 0) {
    return
  }

  const publishCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      users: users,
      notification: {
        title: "Y'a du nouveaux 🥳",
        body: "Quelqu'un arrive dans le groupe !"
      }
    })
  })
  return snsClient.send(publishCommand)
}

function handlerUsersNotInGroup (users, group) {
  if (users.length === 0) {
    return
  }

  const promises = []
  for (const user of users) {
    const updateUserCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: user.id },
      UpdateExpression: `
        SET #group = :groupid
      `,
      ExpressionAttributeNames: {
        '#group': 'group'
      },
      ExpressionAttributeValues: {
        ':groupid': group.id
      }
    })
    promises.push(dynamoDBDocumentClient.send(updateUserCommand))
  }

  const publishCommand = new PublishCommand({
    TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
    Message: JSON.stringify({
      users: users,
      notification: {
        title: 'Viens te présenter 🥳',
        body: 'Je viens de te trouver un groupe !'
      }
    })
  })
  promises.push(snsClient.send(publishCommand))

  return Promise.all(promises)
}

function isGroupValid (user, group, blockedUsers) {
  // Check this group is valid
  if (group.id === user.group) {
    return {
      isValid: false,
      message: `group ${group.id} already has ${user.id}`
    }
  }

  // Is user banned from group
  group.bannedUsers = group.bannedUsers ?? new Set()
  if (group.bannedUsers.has(user.id)) {
    return {
      isValid: false,
      message: `group ${group.id} has banned user ${user.id}`
    }
  }

  // Is a blocked user in the group
  for (const user of group.users) {
    // check user not blocked
    if (blockedUsers.has(user)) {
      return {
        isValid: false,
        message: `group ${group.id} has blocked user ${user}`
      }
    }
  }

  return {
    isValid: true
  }
}
