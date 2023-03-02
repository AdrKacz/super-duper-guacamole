// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { ScanCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))

  // scan all users
  const users = []
  let previousLastEvaluatedKey = null
  while (true) {
    const scanCommandInputOptions = {
      TableName: USERS_TABLE_NAME,
      ProjectionExpression: '#id, #lastConnectionDay',
      FilterExpression: 'attribute_not_exists(#connectionId)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#lastConnectionDay': 'lastConnectionDay',
        '#connectionId': 'connectionId'
      }
    }

    if (previousLastEvaluatedKey !== null) {
      scanCommandInputOptions.ExclusiveStartKey = previousLastEvaluatedKey
    }
    const { Items: items, LastEvaluatedKey: lastEvaluatedKey } = await dynamoDBDocumentClient.send(new ScanCommand(scanCommandInputOptions))
    users.push(...items)

    if (lastEvaluatedKey !== null) {
      break
    } else {
      previousLastEvaluatedKey = lastEvaluatedKey
    }
  }

  console.log(`Scanned ${users.length()} users`)
}
