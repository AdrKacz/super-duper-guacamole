// DEPENDENCIES
// aws-sdk-api
// aws-sdk-ddb

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Send message
// event.Records[0].Sns.Message
// groups (?) : List<String> - List of groupid
// users (?) : List<String> - List of userid
// message: Map<String,String>
//      action - Message action used to sort by Awa app

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')

const {
  DynamoDBDocumentClient,
  BatchGetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb')

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} = require('@aws-sdk/client-apigatewaymanagementapi')

// ===== ==== ====
// CONSTANTS
const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  WEB_SOCKET_ENDPOINT,
  AWS_REGION
} = process.env

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION })
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient)

const apiGatewayManagementApiClient = new ApiGatewayManagementApiClient({
  region: AWS_REGION,
  endpoint: WEB_SOCKET_ENDPOINT
})

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

  const groups = body.groups ?? []
  const users = body.users ?? []
  const message = body.message

  if (message === undefined) {
    throw new Error('message must be defined')
  }

  const concernedUsers = new Set(users)

  // get user grom groups
  if (groups.length > 0) {
    // NOTE: cannot retrieve more than 100 items or 16Mb of data
    const command = new BatchGetCommand({
      RequestItems: {
        [GROUPS_TABLE_NAME]: {
          Keys: groups.map((groupid) => ({ id: groupid })),
          ProjectionExpression: '#id, #users',
          ExpressionAttributeNames: {
            '#id': 'id',
            '#users': 'users'
          }
        }
      }
    })
    const response = await dynamoDBDocumentClient.send(command)
    // TODO: handle response.UnprocessedKeys

    // response.Responses[GROUPS_TABLE_NAME] : List<Map>
    // 1.   [{ id1, [user1, user2] }, { id2, [user3, user4] }]
    // 2.   [[user1, user2], [user3, user4]]
    // 3.   [user1, user2, user3, user4]
    for (const user of new Set(response.Responses[GROUPS_TABLE_NAME].flatMap(({ users }) => users))) {
      concernedUsers.add(user)
    }
  }

  // get connectionIds
  console.log('ConcernedUsers:')
  console.log(concernedUsers) // on its own line because JSON.stringify(Set<String>) outputs '{}'
  const command = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: Array.from(concernedUsers).map((userid) => ({ id: userid })),
        ProjectionExpression: '#id, #connectionId',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#connectionId': 'connectionId'
        }
      }
    }
  })
  const response = await dynamoDBDocumentClient.send(command)

  // send message
  await Promise.allSettled(
    response.Responses[USERS_TABLE_NAME].map(({ id, connectionId }) => (
      new Promise((resolve, reject) => {
        if (connectionId === undefined) {
          console.log(`User <${id}> has no connectionId`)
          return reject(new Error())
        }

        const command = new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify(message)
        })

        apiGatewayManagementApiClient
          .send(command)
          .then((_data) => {
            console.log(`Successfully sent message to <${connectionId}>`)
            resolve()
          })
          .catch((error) => {
            console.log(`Error sending message to <${connectionId}>`)
            if (error.name === 'GoneException') {
              console.log(`Stale connectionId <${connectionId}>`)
            }
            reject(new Error())
          })
      }).catch(async (_error) => {
        // store message (unprocessed user)
        const command = new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: { id: id },
          UpdateExpression: `
              SET #unreadData = list_append(#unreadData, :message)
              REMOVE #connectionId
              `,
          ExpressionAttributeNames: {
            '#unreadData': 'unreadData',
            '#connectionId': 'connectionId'
          },
          ExpressionAttributeValues: {
            ':message': [message]
          }
        })

        await dynamoDBDocumentClient.send(command)
          .then((_data) => {
            console.log(`Update unprocessed user <${id}>`)
          })
          .catch((error) => {
            console.log(`Error updating unprocessed user <${id}>:
${JSON.stringify(error)}`)
          })
      })
    ))
  )
}
