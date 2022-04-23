// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Switch group
// event.Records[0].Sns.Message
// id : String - user id
// groupid : String? - user group id
// connectionId : String? - user connection id

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
`)

  const body = JSON.parse(event.Records[0].Sns.Message)

  const id = body.id
  const groupid = body.groupid
  // const connectionId = body.connectionId

  if (id === undefined) {
    throw new Error('id must be defined')
  }

  // find a new group
  let newgroupid = Math.floor(Math.random() * 9).toString()
  if (newgroupid === groupid) {
    newgroupid = (parseInt(newgroupid) + 1).toString()
  }

  const updateUserCommand = new UpdateCommand({
    ReturnValues: 'ALL_OLD',
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    UpdateExpression: `
    SET #group = :groupid
    REMOVE #unreadData, #banConfirmedUsers, #banVotingUsers, #confirmationRequired
    `,
    ExpressionAttributeNames: {
      '#group': 'group',
      '#unreadData': 'unreadData',
      '#banConfirmedUsers': 'banConfirmedUsers',
      '#banVotingUsers': 'banVotingUsers',
      '#confirmationRequired': 'confirmationRequired'
    },
    ExpressionAttributeValues: {
      ':groupid': newgroupid
    }
  })
  const user = await dynamoDBDocumentClient.send(updateUserCommand).then((response) => (response.Attributes))

  const updateNewGroupCommand = new UpdateCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: newgroupid },
    UpdateExpression: 'ADD #users :id',
    ExpressionAttributeNames: {
      '#users': 'users'
    },
    ExpressionAttributeValues: {
      ':id': new Set([id])
    }
  })

  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: [{ id, connectionId: user.connectionId }],
      message: {
        action: 'switchgroup',
        groupid: newgroupid
      }
    })
  })

  const promises = [
    dynamoDBDocumentClient.send(updateUserCommand),
    dynamoDBDocumentClient.send(updateNewGroupCommand),
    snsClient.send(publishSendMessageCommand)
  ]

  if (user.group !== undefined) {
    const updateOldGroupCommand = new UpdateCommand({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: user.group },
      UpdateExpression: 'DELETE #users :id',
      ExpressionAttributeNames: {
        '#users': 'users'
      },
      ExpressionAttributeValues: {
        ':id': new Set([id])
      }
    })
    promises.push(dynamoDBDocumentClient.send(updateOldGroupCommand))
  }

  await Promise.allSettled(promises)
}
