// ===== ==== ====
// IMPORTS
const { QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { CONSTANTS } = require('chat-backend-package') // skipcq: JS-0260
const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

const { isGroupValid } = require('./is-group-valid')

// ===== ==== ====
// CONSTANTS
const {
  GROUPS_TABLE_NAME,
  GROUPS_IS_PUBLIC_INDEX_NAME
} = process.env

// ===== ==== ====
// EXPORTS
exports.findGroup = async ({ currentUser }) => {
  console.log('find group for current user', currentUser)
  // look for existing group
  const { Count: queryCount, Items: queryItems } = await dynamoDBDocumentClient.send(new QueryCommand({
    TableName: GROUPS_TABLE_NAME,
    IndexName: GROUPS_IS_PUBLIC_INDEX_NAME,
    Limit: 10,
    KeyConditionExpression: '#isPublic = :false AND #city = :city',
    ProjectionExpression: '#id',
    FilterExpression: '#id <> :oldGroupId',
    ExpressionAttributeNames: {
      '#isPublic': 'isPublic',
      '#city': 'city',
      '#id': 'id'
    },
    ExpressionAttributeValues: {
      ':city': currentUser.city,
      ':false': CONSTANTS.FALSE,
      ':oldGroupId': currentUser.groupId ?? ''
    }
  }))

  if (queryCount > 0) {
    // shuffle results
    queryItems.sort(() => 0.5 - Math.random())

    // return first valid group
    for (const { id: groupId } of queryItems) {
      try {
        const { group, users } = await getGroup({ groupId }) // skipcq: JS-0032
        console.log('analyse group', group, users)
        if (isGroupValid({ group, users, currentUser })) {
          return { group, users }
        }
      } catch (error) {
        console.log(`error while getting group (${groupId})`, error)
      }
    }
  }

  return {}
}
