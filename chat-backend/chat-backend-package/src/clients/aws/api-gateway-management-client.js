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
  endpoint: `https://${webSocketEndpointUrl.hostname}${webSocketEndpointUrl.pathname}`
})
