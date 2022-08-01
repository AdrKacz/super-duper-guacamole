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

// BAN - NOT DONE HERE ANYMORE, TO MOVE
// On a ban, BAN_FUNCTION doesn't send user questions because they are not stored.
// For now, I just considered a banned user as an user who hasn't answer any question.``

// NOTE: concurrent runs
// You should be added to an open group with 0 users
// Indeed, the group opens with a minimum number of users
// And close when reaches 0 users
// However, it you are added to a group at the same moment the last user leave the group
// You can be added to a group with 0 users
// (even worst, you could be added to a deleted group)
// TODO: HOW TO DEAL WITH IT?

// ===== ==== ====
// IMPORTS
const {
  GetCommand
} = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const {
  addUserToGroup,
  removeUserFromGroup,
  findGroupToUser,
  updateGroupUsers
} = require('./helpers')

const { dynamoDBDocumentClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME
} = process.env

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
  const blockedUsers = new Set(body.blockedUsers ?? [])

  if (typeof id === 'undefined') {
    throw new Error('id must be defined')
  }

  // get user
  const getUserCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    ProjectionExpression: '#id, #group, #connectionId, #firebaseToken',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#group': 'group',
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

  await Promise.all([
    removeUserFromGroup(user),
    findGroupToUser(user, blockedUsers, questions).then(
      (nextGroup) => (Promise.all([
        updateGroupUsers(user, nextGroup),
        addUserToGroup(user, nextGroup)])
      ))
  ]).then((results) => (console.log(`main results:\n${JSON.stringify(results)}`)))

  return {
    statusCode: 200
  }
}
