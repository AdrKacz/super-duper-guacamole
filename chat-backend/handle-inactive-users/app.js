// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// SCHEDULE

// ===== ==== ====
// EVENT

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tEvent:\n${JSON.stringify(event, null, '\t')}
`)

  // Find inactive and dead users
  const inactiveUsers = {}
  const deadUsersByGroup = {}
  let lastEvaluatedKey
  do {
    const scanCommand = new ScanCommand({
      TableName: USERS_TABLE_NAME,
      ProjectionExpression: '#id, #group, #connectionId, #firebaseToken, #isActive, #lastConnectionHalfDay',
      FilterExpression: '#isActive = :false',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#group': 'group',
        '#connectionId': 'connectionId',
        '#firebaseToken': 'firebaseToken',
        '#isActive': 'isActive',
        '#lastConnectionHalfDay': 'lastConnectionHalfDay'
      },
      ExpressionAttributeValues: {
        '#false': false
      },
      ExclusiveStartKey: lastEvaluatedKey
    })
    const scanOutput = await dynamoDBDocumentClient.send(scanCommand)
    lastEvaluatedKey = scanOutput.LastEvaluatedKey
  } while (lastEvaluatedKey !== undefined)
  // Warn inactive users

  // Remove dead users
}
