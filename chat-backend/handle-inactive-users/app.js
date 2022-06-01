// DEPENDENCIES
// aws-sdk-ddb

// TRIGGER
// SCHEDULE

// ===== ==== ====
// EVENT

// NOTE:

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb')

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
\tEvent:\n${event}
`)
}