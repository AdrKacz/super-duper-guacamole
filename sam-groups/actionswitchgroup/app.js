// DEPENDENCIES
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Switch group
// event.body
// id : String - user id
// groupid : String - group id

// ===== ==== ====
// IMPORTS
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  SWITCH_GROUP_TOPIC_ARN,
  AWS_REGION
} = process.env

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const body = JSON.parse(event.body)

  const id = body.id
  const groupid = body.groupid
  if (id === undefined || groupid === undefined) {
    throw new Error('id and groupid must be defined')
  }

  // switch group
  const publishSwithGroupCommand = new PublishCommand({
    TopicArn: SWITCH_GROUP_TOPIC_ARN,
    Message: JSON.stringify({
      id: id,
      groupid: groupid !== '' ? groupid : undefined,
      connectionId: event.requestContext.connectionId
    })
  })

  await snsClient.send(publishSwithGroupCommand)

  return {
    statusCode: 200
  }
}
