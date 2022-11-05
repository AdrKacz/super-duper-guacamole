// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { AWS_REGION } = process.env

// ===== ==== ====
// CONSTANTS
const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })

const marshallOptions = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`.
  convertEmptyValues: true, // false, by default.
  // Whether to remove undefined values while marshalling.
  removeUndefinedValues: true, // false, by default.
  // Whether to convert typeof object to map attribute.
  convertClassInstanceToMap: false // false, by default.
}

const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false // false, by default.
}

const translateConfig = { marshallOptions, unmarshallOptions }

// ===== ==== ====
// EXPORTS
exports.dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient, translateConfig)
