// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// SCHEDULE

// ===== ==== ====
// EVENT

// ===== ==== ====
// IMPORTS
const { ScanCommand, UpdateCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb')

const { PublishCommand } = require('@aws-sdk/client-sns')

const { removeUsersFromGroup } = require('./helpers')

const { dynamoDBDocumentClient, snsClient } = require('./aws-clients')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  SEND_NOTIFICATION_TOPIC_ARN
} = process.env

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tEvent:\n${JSON.stringify(event, null, '\t')}
`)

  // Find inactive and dead users
  const deactivatedUsersWithGroup = []
  const deadUsersByGroup = {}
  const deadUsersWithoutGroup = []
  const deadUsersWithGroup = []
  const promises = []
  const lastHalfDay = ((ts) => (ts - (ts % 43200000)))(Date.now())
  let lastEvaluatedKey
  do {
    const scanCommand = new ScanCommand({
      TableName: USERS_TABLE_NAME,
      ProjectionExpression: '#id, #group, #firebaseToken, #isInactive, #lastConnectionHalfDay',
      FilterExpression: 'attribute_not_exists(#connectionId)', // to retreive only disconnected users
      ExpressionAttributeNames: {
        '#id': 'id',
        '#group': 'group',
        '#connectionId': 'connectionId',
        '#firebaseToken': 'firebaseToken',
        '#isInactive': 'isInactive',
        '#lastConnectionHalfDay': 'lastConnectionHalfDay'
      },
      ExclusiveStartKey: lastEvaluatedKey
    })
    const scanOutput = await dynamoDBDocumentClient.send(scanCommand)
    console.log(`Receive scanOutput (key: ${lastEvaluatedKey})\n${JSON.stringify(scanOutput, null, '\t')}`)
    lastEvaluatedKey = scanOutput.LastEvaluatedKey
    for (const user of scanOutput.Items) {
      // check if user is dead
      const userIsInactive = user.isInactive ?? false
      if (userIsInactive) {
        // the inactive flag is remove at each connection
        // if it is still there the user didn't respond to the warning
        if (user.group === undefined) {
          deadUsersWithoutGroup.push(user)
        } else {
          deadUsersWithGroup.push(user)
          if (deadUsersByGroup[user.group] === undefined) {
            deadUsersByGroup[user.group] = [user]
          } else {
            deadUsersByGroup[user.group].push(user)
          }
        }
        continue // don't deactivate a dead user
      }

      // check if user is inactive
      const userLastConnectionHalfDay = user.lastConnectionHalfDay ?? 0
      const halfDayDifference = Math.floor(Math.abs(lastHalfDay - userLastConnectionHalfDay) / 43200000) + 2 // + 2 DEBUG
      if (halfDayDifference > 1) {
        // user inactive: at least 12h without connection
        promises.push(deactivateUser(user).then(() => { console.log(`User ${user.id} deactivated`) }))
        if (user.group !== undefined) {
          deactivatedUsersWithGroup.push(user)
        }
      }
    }
  } while (lastEvaluatedKey !== undefined) // DynamoDB cannot read more than 1Mb of data at once

  // Kill users
  console.log(`Dead User Without Group:\n${JSON.stringify(deadUsersWithoutGroup, null, '\t')}`)
  promises.push(killUsers(deadUsersWithoutGroup).then(() => { console.log('Killed users without group') }))
  console.log(`Dead User By Group:\n${JSON.stringify(deadUsersByGroup, null, '\t')}`)
  for (const deadUsers of Object.values(deadUsersByGroup)) {
    promises.push(killUsers(deadUsers).then(() => { console.log(`Killed users with group ${deadUsers[0].group}`) }))
  }

  // Warn dead user
  console.log(`Dead User With Group (to warn):\n${JSON.stringify(deadUsersWithGroup, null, '\t')}`)
  if (deadUsersWithGroup.length > 0) {
    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: deadUsersWithGroup,
        notification: {
          title: "Tu n'es plus dans ton groupe 😢",
          body: 'Ça fait trop longtemps que tu ne participes plus ...'
        }
      })
    })
    promises.push(snsClient.send(publishSendNotificationCommand))
  }

  // Warn deactivate user
  console.log(`Deactivated User (to warn):\n${JSON.stringify(deactivatedUsersWithGroup, null, '\t')}`)
  if (deactivatedUsersWithGroup.length > 0) {
    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: deactivatedUsersWithGroup,
        notification: {
          title: 'Connecte toi avant demain ⏰',
          body: "Plus personne n'a de nouvelle de toi dans ton groupe ..."
        }
      })
    })
    promises.push(snsClient.send(publishSendNotificationCommand))
  }

  await Promise.allSettled(promises).then((results) => console.log(`Promises resolved\n${JSON.stringify(results, null, '\t')}`))
}

// ===== ==== ====
// HELPERS
async function killUsers (deadUsers) {
  // Remove user from its group and from database
  // deadUser: Map
  //    id: String - user id
  //    group: String - user group id
  //    firebaseToken : String - user firebase token

  if (deadUsers.length === 0) {
    console.log('You need at least 1 user to kill')
    return
  }

  await removeUsersFromGroup(deadUsers)

  // Delete user from database
  const maximumNumberOfRequest = 25 // Cannot send more than 25 operations
  for (let i = 0; i < Math.ceil(deadUsers.length / maximumNumberOfRequest); i++) {
    const batchWriteDeleteCommand = new BatchWriteCommand({
      RequestItems: {
        [USERS_TABLE_NAME]: deadUsers.slice(i * maximumNumberOfRequest, (i + 1) * maximumNumberOfRequest).map((deadUser) => ({
          DeleteRequest: {
            Key: { id: deadUser.id }
          }
        }))
      }
    })
    await dynamoDBDocumentClient.send(batchWriteDeleteCommand).catch(err => { console.log('Error while deleting:\n', err) })
  }
}

async function deactivateUser (inactiveUser) {
  // Warn user it will be killed if no action before tomorrow
  // inactiveUser: Map
  //    id: String - user id

  console.log(`Add user ${inactiveUser.id} inactive tag`)
  const updateInactiveUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: inactiveUser.id },
    UpdateExpression: 'SET #isInactive = :true',
    ExpressionAttributeNames: {
      '#isInactive': 'isInactive'
    },
    ExpressionAttributeValues: {
      ':true': true
    }
  })

  await dynamoDBDocumentClient.send(updateInactiveUserCommand)
}
