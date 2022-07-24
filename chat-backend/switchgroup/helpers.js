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
/**
 * Remove user from its group.
 * @todo update user and group in parallel
 *
 * @param {Object} user
 * @param {string} user.id - id
 * @param {string} user.group - group id
 */
exports.removeUserFromGroup = async (user) => {
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
  await dynamoDBDocumentClient.send(updateUserCommand)

  // update group
  if (typeof user.group === 'undefined') {
    return
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
    return
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
    return
  }

  // there is no more user in the group, delete it
  // NOTE - concurrent runs
  // two concurrents update, one removing a user and one adding a user
  //    to the same group can results in unexpected behaviour
  // your group could be temporary empty, so you will delete it
  // the added user will be in a no-mans-land
  //    and will ask for a new group, that results in longer waiting time

  const deleteGroupCommand = new DeleteCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.group }
  })
  await dynamoDBDocumentClient.send(deleteGroupCommand)

  // you need to tell user of the group about the new status of the group
  // register will do the trick on the next connection, but trigger it before
  // WARNING: this don't deal with ban anymore, you have to deal it elsewhere
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
 * @param {string[]} group.users - user ids
 * @param {boolean} group.isOpen
 * @param {number} group.isWaiting - 1 if is not full, else 0
 * @param {Object.<string, string>} group.questions
 */
exports.addUserToGroup = async (user, group) => {
  if (!group.isOpen && group.users.size >= MINIMUM_GROUP_SIZE - 1) {
    group.isOpen = true // open group
  }

  if (group.users.size >= MAXIMUM_GROUP_SIZE - 1) {
    group.isWaiting = 0 // false
  }

  const updateGroupCommand = new UpdateCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: group.id },
    UpdateExpression: `
          SET #isWaiting = :isWaiting, #questions = :questions #isOpen = :isOpen
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

  await dynamoDBDocumentClient.send(updateGroupCommand)

  if (!group.isOpen) {
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

  // send message
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

  return Promise.all([
    snsClient.send(publishCommand),
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
