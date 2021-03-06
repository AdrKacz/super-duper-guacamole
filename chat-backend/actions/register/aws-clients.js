// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS

const { AWS_REGION } = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
exports.dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

exports.snsClient = new SNSClient({ region: AWS_REGION })
