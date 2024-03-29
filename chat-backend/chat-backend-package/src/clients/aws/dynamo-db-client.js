// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { AWS_REGION } = process.env

// ===== ==== ====
// CONSTANTS
const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })

// ===== ==== ====
// EXPORTS
exports.dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)
