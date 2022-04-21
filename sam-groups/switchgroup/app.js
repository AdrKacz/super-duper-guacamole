// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Switch group
// event.Records[0].Sns.Message
// user : Map<String,String>
//    id
//    groupid (?)
//    connectionId (?)

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
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
  console.log(`
Receives:
\tRecords[0].Sns.Message:
${event.Records[0].Sns.Message}
\tRecords:
${JSON.stringify(event.Records)}
\tEnvironment:\n${JSON.stringify(process.env)}
`)

  const body = JSON.parse(event.Records[0].Sns.Message)

  const user = body.user
  if (user === undefined || user.id === undefined) {
    throw new Error('user.id must be defined')
  }

  // find a new group
  let groupid = Math.floor(Math.random() * 9).toString()
  if (user.groupid && user.groupid === groupid) {
    groupid = (parseInt(groupid) + 1).toString()
  }

  // update user
  const commands = [
    // update new group
    new UpdateCommand({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: groupid },
      UpdateExpression: `
      ADD #users :id
      `,
      ExpressionAttributeNames: {
        '#users': 'users'
      },
      ExpressionAttributeValues: {
        ':id': new Set([user.id])
      }
    }),
    // update user
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: user.id },
      UpdateExpression: `
      SET #group = :id
      REMOVE #unreadData
      `,
      ExpressionAttributeNames: {
        '#group': 'group',
        '#unreadData': 'unreadData'
      },
      ExpressionAttributeValues: {
        ':id': groupid
      }
    })
  ]

  if (user.groupid !== undefined) {
    // update old group if any
    commands.push(
      new UpdateCommand({
        TableName: GROUPS_TABLE_NAME,
        Key: { id: user.groupid },
        UpdateExpression: `
      DELETE #users :id
      `,
        ExpressionAttributeNames: {
          '#users': 'users'
        },
        ExpressionAttributeValues: {
          ':id': new Set([user.id])
        }
      }))
  }

  // TODO: revert if errors
  await Promise.allSettled(commands.map((command) => (
    new Promise((resolve, _reject) => {
      dynamoDBDocumentClient.send(command)
        .catch((error) => {
          console.log(`Error:
${JSON.stringify(error)}
With command input:
${JSON.stringify(command.input)}`)
        })
        .finally(() => {
          resolve() // resolve anyway
        })
    })
  )))

  // send message
  // NOTE: could be done in parallel of DDB updates
  const command = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [user.id],
      message: {
        action: 'switchgroup',
        groupid: groupid
      }
    })
  })
  await snsClient.send(command)
}
