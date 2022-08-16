// ===== ==== ====
// IMPORTS
// const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
// const { DynamoDBDocumentClient, BatchGetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

// const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
// const {
//   USERS_TABLE_NAME,
//   USERS_CONNECTION_ID_INDEX_NAME,
//   GROUPS_TABLE_NAME,
//   SEND_MESSAGE_TOPIC_ARN,
//   SEND_NOTIFICATION_TOPIC_ARN,
//   AWS_REGION
// } = process.env

// const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
// const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)
// const snsClient = new SNSClient({ region: AWS_REGION })

/**
 * Share profile to other group users
 *
 * @param {Object} event
 * @param {string} user.requestContext.connectionId
 * @param {Object} user.body
 * @param {string} user.body.profile
 */
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)
}
