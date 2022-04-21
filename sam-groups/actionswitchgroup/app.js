// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Switch group
// event.body
// id : String - userid

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  SWITCH_GROUP_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context:\n${JSON.stringify(event.requestContext)}
\tEnvironment:\n${JSON.stringify(process.env)}
`)

  const body = JSON.parse(event.body)

  // userid
  const id = body.id
  if (id === undefined) {
    throw new Error('id must be defined')
  }

  // retreive user and verify connectionId
  const getCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    ProjectionExpression: '#id, #group, #connectionId',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#group': 'group',
      '#connectionId': 'connectionId'
    }
  })
  const response = await dynamoDBDocumentClient.send(getCommand)
  console.log(`Response for user <${id}>:
${JSON.stringify(response)}`)

  if (response.Item === undefined || response.Item.connectionId === undefined) {
    throw new Error(`user <${id}> is not defined or has no connectionId`)
  }

  if (response.Item.connectionId !== event.requestContext.connectionId) {
    throw new Error(`user <${id}> has connectionId <${response.Item.connectionId}> but sent request via connectionId <${event.requestContext.connectionId}>`)
  }

  // switch group
  const publishCommand = new PublishCommand({
    TopicArn: SWITCH_GROUP_TOPIC_ARN,
    Message: JSON.stringify({
      user: {
        id: response.Item.id,
        groupid: response.Item.group,
        connectionId: response.Item.connectionId
      }
    })
  })

  await snsClient.send(publishCommand)

  return {
    statusCode: 200
  }
}
