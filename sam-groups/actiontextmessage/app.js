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
// message : String

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
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
  const message = body.message
  if (id === undefined || message === undefined) {
    throw new Error('id and message must be defined')
  }

  // retreive user
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

  if (response.Item === undefined || response.Item.connectionId === undefined || response.Item.group === undefined) {
    throw new Error(`user <${id}> is not defined or has no connectionId or had no group`)
  }

  if (response.Item.connectionId !== event.requestContext.connectionId) {
    throw new Error(`user <${id}> has connectionId <${response.Item.connectionId}> but sent request via connectionId <${event.requestContext.connectionId}>`)
  }

  // send message
  const publishCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      groups: [response.Item.group],
      message: {
        action: 'textmessage',
        message: message
      }
    })
  })

  await snsClient.send(publishCommand)

  return {
    statusCode: 200
  }
}
