// ===== ==== ====
// IMPORTS
const { QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { getGroup } = require('chat-backend-package') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260

const { isGroupValid } = require('./is-group-valid')

// ===== ==== ====
// CONSTANTS
const {
  GROUPS_TABLE_NAME,
  GROUPS_BUBBLE_INDEX_NAME
} = process.env

// ===== ==== ====
// EXPORTS
exports.findGroup = async ({ currentUser }) => {
  // look for existing group
  const { Count: queryCount, Items: queryItems } = await dynamoDBDocumentClient.send(new QueryCommand({
    TableName: GROUPS_TABLE_NAME,
    IndexName: GROUPS_BUBBLE_INDEX_NAME,
    Limit: 10,
    KeyConditionExpression: '#bubble = :bubble AND #groupSize < :five',
    ProjectionExpression: '#id',
    FilterExpression: '#id <> :oldGroupId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#bubble': 'bubble',
      '#groupSize': 'groupSize'
    },
    ExpressionAttributeValues: {
      ':bubble': currentUser.bubble,
      ':five': 5,
      ':oldGroupId': currentUser.groupId ?? ''
    }
  }))

  if (queryCount > 0) {
    // shuffle results
    queryItems.sort(() => 0.5 - Math.random())

    // return first valid group
    for (const { id: groupId } of queryItems) {
      const { group, users } = await getGroup({ groupId }) // skipcq: JS-0032
      console.log('analyse group', group, users)
      if (isGroupValid({ group, users, currentUser })) {
        return { group, users }
      }
    }
  }

  return {}
}
