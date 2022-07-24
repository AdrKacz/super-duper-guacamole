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
  GetCommand,
  QueryCommand
} = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { v4: uuidv4 } = require('uuid')

const { addUserToGroup, removeUserFromGroup } = require('./helpers')

const { dynamoDBDocumentClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  GROUPS_WAINTING_ID_INDEX_NAME
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
  // TODO: move findGroup to helpers and add isOpen (false by default)
  // OR (better) add default to addUserToGroup
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

  // NOTE: the logic is as easy as possible but hasn't been statically tested, IT NEEDS TO BE.
  // We must check that answers indeed have a greater impact on group than order of arrival.
  // If not that means that we are still quite randomly assigning groups.

  // NOTE: We could add ENV VARIABLE for more fine grained controls.
  // For exemple, we could decide to create a new group, no matter what, if the maximum of similarity is smaller than a given value.

  // NOTE: We may want to shuffle the order in which we loop through the groups to have different result
  // on each run, for different user
  // (there is NO order in the Query, it is "first found first returned")
  // (however, getting that the query is simlar, we could imagine that the processed time will be similar for each item too)
  // (thus, the order being similar too)
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
    removeUserFromGroup(user)
  ]

  await Promise.allSettled(promises).then((results) => console.log(JSON.stringify(results)))
  return {
    statusCode: 200
  }
}
