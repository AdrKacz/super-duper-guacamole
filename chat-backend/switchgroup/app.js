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
// TODO
// Remove group from user and only add it when the group become visible
// If not, you send the new group to the user on register but the user isn't supposed to be aware of it

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
const {
  GetCommand
} = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { addUserToGroup, removeUserFromGroup, findGroupToUser } = require('./helpers')

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
  const blockedUsers = body.blockedUsers ?? []

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

  await removeUserFromGroup(user)

  const nextGroup = await findGroupToUser(user, blockedUsers, questions)

  await addUserToGroup(user, nextGroup)

  return {
    statusCode: 200
  }
}
