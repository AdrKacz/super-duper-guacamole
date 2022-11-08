// ===== ==== ====
// IMPORTS
const { ApiGatewayManagementApiClient } = require('@aws-sdk/client-apigatewaymanagementapi') // skipcq: JS-0260

const {
  WEB_SOCKET_ENDPOINT,
  AWS_REGION
} = process.env

// ===== ==== ====
// CONSTANTS
const webSocketEndpointUrl = new URL(WEB_SOCKET_ENDPOINT) // skipcq: JS-0269

// ===== ==== ====
// EXPORTS
exports.apiGatewayManagementApiClient = new ApiGatewayManagementApiClient({
  region: AWS_REGION,
  endpoint: {
    protocol: 'https', // webSocketEndpointUrl.protocol = 'wss' doesn't work
    hostname: webSocketEndpointUrl.hostname,
    path: webSocketEndpointUrl.pathname
  }
})
