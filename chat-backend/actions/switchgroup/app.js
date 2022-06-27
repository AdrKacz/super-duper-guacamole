// DEPENDENCIES
// aws-sdk-sns

// TRIGGER
// API GATEWAY WEB SOCKET

// ===== ==== ====
// EVENT
// Switch group
// event.body
// questions : Map<String, String>?
//    question id <String> - answer id <String>
// blockedUsers : List<String>?
//    blockedUser userId

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  SWITCH_GROUP_TOPIC_ARN,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const snsClient = new SNSClient({ region: AWS_REGION })

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const { id, group } = await connectionIdToUserIdAndGroupId(event.requestContext.connectionId)

  if (typeof id === 'undefined') {
    return
  }

  const body = JSON.parse(event.body)
  const questions = body.questions
  const blockedUsers = body.blockedUsers

  // switch group
  const publishSwithGroupCommand = new PublishCommand({
    TopicArn: SWITCH_GROUP_TOPIC_ARN,
    Message: JSON.stringify({
      id,
      groupid: group,
      connectionId: event.requestContext.connectionId,
      questions,
      blockedUsers
    })
  })

  await snsClient.send(publishSwithGroupCommand)

  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
async function connectionIdToUserIdAndGroupId (connectionId) {
  // Get userId and GroupId associated with connectionId
  // connetionId - String
  const queryCommand = new QueryCommand({
    TableName: USERS_TABLE_NAME,
    IndexName: USERS_CONNECTION_ID_INDEX_NAME,
    KeyConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  })
  const user = await dynamoDBDocumentClient.send(queryCommand).then((response) => {
    console.log('Query Response:', response)
    if (response.Count > 0) {
      return response.Items[0]
    }
    return {}
  })

  if (typeof user.id === 'undefined') {
    return {}
  }
  return { id: user.id, group: user.group }
}
