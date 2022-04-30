// DEPENDENCIES
// aws-sdk-ddb
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET - $disconnect

// ===== ==== ====
// EVENT
// Call on disconnection, client doesn't provide an event

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, BatchGetCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  GROUPS_TABLE_NAME,
  SEND_MESSAGE_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  // get connectionId group (with global secondary index)
  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': event.requestContext.connectionId
    }
  })
  const user = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    console.log('Query Response:', response)
    if (response.Count > 0) {
      return response.Items[0]
    } else {
      return undefined
    }
  })

  if (user === undefined || user.id === undefined) {
    return
  }
  // update user
  const updateUser = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: user.id },
    UpdateExpression: 'SET #isActive = :isActive',
    ExpressionAttributeNames: {
      '#isActive': 'isActive'
    },
    ExpressionAttributeValues: {
      ':isActive': false
    }
  })
  const updatePromise = dynamoDBDocumentClient.send(updateUser)

  if (user.group === undefined) {
    await updatePromise
    return
  }

  // retreive group (if any)
  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: user.group },
    ProjectionExpression: '#id, #users',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#users': 'users'
    }
  })
  const group = await dynamoDBDocumentClient.send(getGroupCommand).then((response) => (response.Item))

  if (group === undefined) {
    throw new Error(`group <${user.group}> is not defined`)
  }

  // retreive users
  const otherUserIds = Array.from(group.users).filter((id) => (id !== user.id))
  if (otherUserIds.length === 0) {
    return
  }
  const batchGetUsersCommand = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: otherUserIds.map((id) => ({ id: id })),
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })

  const users = await dynamoDBDocumentClient.send(batchGetUsersCommand).then((response) => (response.Responses[USERS_TABLE_NAME]))

  const publishSendMessageCommand = new PublishCommand({
    TopicArn: SEND_MESSAGE_TOPIC_ARN,
    Message: JSON.stringify({
      users: users,
      message: {
        action: 'logout',
        id: user.id
      }
    })
  })
  await snsClient.send(publishSendMessageCommand)
  await updatePromise
}

// ===== ==== ====
// HELPERS
