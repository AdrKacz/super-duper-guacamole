// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')

const { SNSClient } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS

const { AWS_REGION } = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
exports.dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

exports.snsClient = new SNSClient({ region: AWS_REGION })
