// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { CONSTANTS } = require('chat-backend-package') // skipcq: JS-0260
const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260

const {
  GROUPS_TABLE_NAME,
  GROUPS_IS_PUBLIC_INDEX_NAME
} = process.env

const MILLISECONDS_PER_DAY = 86400000

// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))

  // scan all users
  const groups = []
  let previousLastEvaluatedKey = null
  let hasReachLastPage = false
  while (!hasReachLastPage) {
    const queryCommandInputOptions = {
      TableName: GROUPS_TABLE_NAME,
      IndexName: GROUPS_IS_PUBLIC_INDEX_NAME,
      KeyConditionExpression: '#isPublic = :true',
      ProjectionExpression: '#id',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#isPublic': 'isPublic'
      },
      ExpressionAttributeValues: {
        ':true': CONSTANTS.TRUE
      }
    }

    if (previousLastEvaluatedKey !== null) {
      queryCommandInputOptions.ExclusiveStartKey = previousLastEvaluatedKey
    }

    const { Items: items, LastEvaluatedKey: lastEvaluatedKey } = await dynamoDBDocumentClient.send(new QueryCommand(queryCommandInputOptions))
    groups.push(...items)

    if (typeof lastEvaluatedKey === 'undefined') {
      hasReachLastPage = true
    } else {
      previousLastEvaluatedKey = lastEvaluatedKey
    }
  }

  console.log(`queried ${groups.length} groups`, groups)

  // look for users without activity
  const todayString = (new Date()).toISOString().split('T')[0]
  const today = new Date(todayString)
  const usersWithoutActivity = []
  console.log('start analysis for today', today)
  for (const { id: groupId } of groups) {
    try {
      const { group, users } = await getGroup({ groupId })
      console.log('analyse group', group, users)
      for (const user of users) {
        const id = user.id
        const lastConnectionDayString = user.lastConnectionDay ?? 0
        const lastConnectionDay = new Date(lastConnectionDayString)
        const differenceInDay = Math.floor((today - lastConnectionDay) / MILLISECONDS_PER_DAY)
        console.log(`user (${id}) difference in day is ${differenceInDay} (last connection day is ${lastConnectionDay})`)
        if (differenceInDay > 0) {
          console.log('too long before last activity, send notification to user', id)
          usersWithoutActivity.push(user)
        }
      }
    } catch (error) {
      console.log(`error while getting group (${groupId})`, error)
    }
  }

  // notify users
  await sendNotifications({
    users: usersWithoutActivity,
    notification: {
      title: 'Viens donner de tes nouvelles 🎉',
      body: 'Ton groupe a besoin de toi !'
    }
  })
}
