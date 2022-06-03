// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// SCHEDULE

// ===== ==== ====
// EVENT

// ===== ==== ====
// NOTE
// Difference between isActive to false and isInactive to true
// isInactive to true: No connection for the last 24h
// isActive to false: No currently using the app

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  SEND_NOTIFICATION_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tEvent:\n${JSON.stringify(event, null, '\t')}
`)

  // Find inactive and dead users
  const deactivatedUsers = []
  const deadUsers = []
  const promises = []
  const lastHalfDay = ((ts) => (ts - (ts % 43200000)))(Date.now())
  let lastEvaluatedKey
  do {
    const scanCommand = new ScanCommand({
      TableName: USERS_TABLE_NAME,
      ProjectionExpression: '#id, #group, #connectionId, #firebaseToken, #isActive, #isInactive, #lastConnectionHalfDay',
      FilterExpression: '#isActive = :false',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#group': 'group',
        '#connectionId': 'connectionId',
        '#firebaseToken': 'firebaseToken',
        '#isActive': 'isActive',
        '#isInactive': 'isInactive',
        '#lastConnectionHalfDay': 'lastConnectionHalfDay'
      },
      ExpressionAttributeValues: {
        '#false': false
      },
      ExclusiveStartKey: lastEvaluatedKey
    })
    const scanOutput = await dynamoDBDocumentClient.send(scanCommand)
    console.log(`Receive scanOutput (key: ${lastEvaluatedKey})\n${JSON.stringify(scanOutput, null, '\t')}`)
    lastEvaluatedKey = scanOutput.LastEvaluatedKey
    for (const user in scanOutput.Items) {
      // check if user is dead
      const userIsInactive = user.isInactive ?? false
      if (userIsInactive) {
        // the inactive flag is remove at each connection
        // if it is still there the user didn't respond to the warning
        promises.push(killUser(user))
        if (user.group !== undefined) {
          deadUsers.push(user)
        }
        break // don't deactivate a dead user
      }

      // check if user is inactive
      const userLastConnectionHalfDay = user.lastConnectionHalfDay ?? 0
      const halfDayDifference = Math.floor(Math.abs(lastHalfDay - userLastConnectionHalfDay) / 43200000)
      if (halfDayDifference > 1) {
        // user inactive: more than 24h without connection
        promises.push(deactivateUser(user))
        if (user.group !== undefined) {
          deactivatedUsers.push(user)
        }
      }
    }
  } while (lastEvaluatedKey !== undefined) // DynamoDB cannot read more than 1Mb of data at once

  // Warn dead user
  if (deadUsers.length > 0) {
    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: deadUsers,
        notification: {
          title: 'Tu ne fais plus partie de ton groupe 😢',
          body: 'Ça fait trop longtemps que tu ne participes plus ...'
        }
      })
    })
    promises.push(snsClient.send(publishSendNotificationCommand))
  }

  // Warn deactivate user
  if (deactivatedUsers.length > 0) {
    const publishSendNotificationCommand = new PublishCommand({
      TopicArn: SEND_NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify({
        users: deactivatedUsers,
        notification: {
          title: 'Connecte toi avant demain ⏰',
          body: "Plus personne n'a de nouvelle de toi dans ton groupe ..."
        }
      })
    })
    promises.push(snsClient.send(publishSendNotificationCommand))
  }

  await Promise.allSettled(promises)
}

// ===== ==== ====
// HELPERS
async function killUser (deadUser) {
  // Remove user from its group and from database
  // deadUser: Map
  //    id: String - user id
  //    group: String - user group id
  //    firebaseToken : String - user firebase token


  // Delete user from database
  const deleteDeadUserCommand = new DeleteCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: deadUser.id }
  })

  await dynamoDBDocumentClient.send(deleteDeadUserCommand)

  // Remove user from its group
}

async function deactivateUser (inactiveUser) {
  // Warn user it will be killed if no action before tomorrow
  // inactiveUser: Map
  //    id: String - user id
  //    firebaseToken : String - user firebase token
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
