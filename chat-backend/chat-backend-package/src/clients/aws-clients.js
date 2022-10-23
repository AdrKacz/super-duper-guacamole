// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260
const { ApiGatewayManagementApiClient } = require('@aws-sdk/client-apigatewaymanagementapi') // skipcq: JS-0260

const {
  WEB_SOCKET_ENDPOINT,
  AWS_REGION
} = process.env

// ===== ==== ====
// CONSTANTS
const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const webSocketEndpointUrl = new URL(WEB_SOCKET_ENDPOINT) // skipcq: JS-0269

// ===== ==== ====
// EXPORTS
exports.dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)
exports.apiGatewayManagementApiClient = new ApiGatewayManagementApiClient({
  region: AWS_REGION,
  endpoint: {
    protocol: 'https', // webSocketEndpointUrl.protocol = 'wss' doesn't work
    hostname: webSocketEndpointUrl.hostname,
    path: webSocketEndpointUrl.pathname
  }
})
