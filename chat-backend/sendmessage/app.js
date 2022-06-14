// DEPENDENCIES
// aws-sdk-api
// aws-sdk-sns

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Send message
// event.Records[0].Sns.Message
// users : List<Object> -
//      id - user id
//      connectionId - user connection id
// message: Map<String,String>
//      action : String - action performed

// NOTE:
// could take connectionIds as input to not retrieve it twice
// need to be linked with userids in case some are undefined or stales

// ===== ==== ====
// IMPORTS
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  WEB_SOCKET_ENDPOINT,
  STORE_UNREAD_DATA_TOPIC_ARN,
  AWS_REGION
} = process.env

const webSocketEndpointUrl = new URL(WEB_SOCKET_ENDPOINT)
const apiGatewayManagementApiClient = new ApiGatewayManagementApiClient({
  region: AWS_REGION,
  endpoint: {
    protocol: 'https', // webSocketEndpointUrl.protocol = 'wss' doesn't work
    hostname: webSocketEndpointUrl.hostname,
    path: webSocketEndpointUrl.pathname
  }
})

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`
Receives:
\tRecords[0].Sns.Message:
${event.Records[0].Sns.Message}
`)

  const body = JSON.parse(event.Records[0].Sns.Message)

  const users = body.users
  const message = body.message

  if (users === undefined || message === undefined) {
    throw new Error('users and message must be defined')
  }

  // send message
  const stringifiedMessage = JSON.stringify(message)
  const rejectedUsers = []
  await Promise.allSettled(users.map(({ id, connectionId }) => (
    new Promise((resolve, _reject) => {
      if (connectionId === undefined) {
        console.log(`User <${id}> has no connectionId`)
        rejectedUsers.push({ id, connectionId })
        return resolve()
      }

      const postToConnectionCommand = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: stringifiedMessage
      })

      console.log(`Send message to <${id}> - <${connectionId}>`)
      apiGatewayManagementApiClient
        .send(postToConnectionCommand)
        .then((_data) => {
          resolve()
        })
        .catch((err) => {
          console.log(`Error sending message to <${id}> - <${connectionId}>
${JSON.stringify(err)}`)
          rejectedUsers.push({ id, connectionId })
          return resolve()
        })
    })
  )))

  if (rejectedUsers.length > 0) {
    const publishCommand = new PublishCommand({
      TopicArn: STORE_UNREAD_DATA_TOPIC_ARN, // it removes connectionId too
      Message: JSON.stringify({
        users: rejectedUsers,
        message: message
      })
    })

    await snsClient.send(publishCommand)
  }
}
