// ===== ==== ====
// IMPORTS
const { GetCommand, BatchGetCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  MAXIMUM_GROUP_SIZE,
  MINIMUM_GROUP_SIZE,
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN
} = process.env

// ===== ==== ====
// EXPORTS
exports.removeUsersFromGroup = async (users) => {
  // Remove users grom their group
  // users : List<Map>
  //    id : String - user id
  //    group : String - user group id

  const groupid = users[0].group

  if (groupid === undefined) {
    return
  }

  // retreive group (needed to count its users)
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupid },
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
  if (group !== undefined) {
    group.users = group.users ?? new Set()
    for (const user of users) {
      group.users.delete(user.id) // simulate remove user id (will be removed -for real- below)
    }

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
    if (group.users.size > 0) {
      // update group (add to bannedUsers if isBan)
      const expressionAttributeNames = {
        '#isWaiting': 'isWaiting',
        '#users': 'users'
      }

      const updateGroupCommand = new UpdateCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: groupid },
        UpdateExpression: `
          SET #isWaiting = :isWaiting
          DELETE #users :ids
          `,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: {
          ':ids': new Set(users.map(({ id }) => (id))),
          ':isWaiting': group.isWaiting ?? 1 // true
        }
      })
      promises.push(dynamoDBDocumentClient.send(updateGroupCommand))

      // retrieve remaining user to warn them
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
      // send message to other group users to notify user has leaved the group (excluding itself)
      for (const user of users) {
        const publishSendMessageCommand = new PublishCommand({
          TopicArn: SEND_MESSAGE_TOPIC_ARN,
          Message: JSON.stringify({
            users: otherUsers,
            message: {
              action: 'leavegroup',
              groupid,
              id: user.id
            }
          })
        })
        promises.push(snsClient.send(publishSendMessageCommand))
      }
    } else {
      // delete group
      const deleteGroupCommand = new DeleteCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: groupid }
      })
      promises.push(dynamoDBDocumentClient.send(deleteGroupCommand))
      console.log(`Delete old group <${groupid}>`)
    }

    await Promise.allSettled(promises)
  }
}
