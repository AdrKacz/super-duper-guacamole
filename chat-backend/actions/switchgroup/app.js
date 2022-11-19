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

const jwt = require('jsonwebtoken') // skipcq: JS-0260

const axios = require('axios').default

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  USERS_CONNECTION_ID_INDEX_NAME,
  AWS_REGION,
  JWK_PRIVATE_KEY,
  AUTHENTICATION_STAGE,
  HTTP_API_URL
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`Receives:
\tBody:\n${event.body}
\tRequest Context connectionId: ${event.requestContext.connectionId}
`)

  const { id } = await connectionIdToUserId(event.requestContext.connectionId)

  if (typeof id === 'undefined') {
    return
  }

  const body = JSON.parse(event.body)
  const questions = body.questions
  const blockedUsers = body.blockedUsers

  // temp, to have same logic in old web socket api and http api
  const jwtToken = jwt.sign({ id }, JWK_PRIVATE_KEY, {
    algorithm: 'RS256',
    keyid: AUTHENTICATION_STAGE,
    expiresIn: 15 * 60,
    notBefore: 0,
    audience: 'user',
    issuer: 'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/chat-backend'
  })

  const response = await axios.post(`${HTTP_API_URL}/change-group`, {
    questions,
    blockedUsers
  }, {
    headers: {
      Authorization: `Bearer ${jwtToken}`
    }
  })

  console.log(response)

  return {
    statusCode: 200
  }
}

// ===== ==== ====
// HELPERS
async function connectionIdToUserId (connectionId) {
  // Get userId and GroupId associated with connectionId
  // connectionId - String
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
  return { id: user.id }
}
