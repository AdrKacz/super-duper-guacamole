// ===== ==== ====
// IMPORTS
const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260
const { sendMessages } = require('chat-backend-package/src/send-messages') // skipcq: JS-0260

const { USERS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))

  const connectionId = event.requestContext.connectionId

  const { id, groupId } = await getUser({ id: event.requestContext.authorizer.id })

  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET #connectionId = :connectionId, #lastConnectionDay = :today',
    ExpressionAttributeNames: {
      '#connectionId': 'connectionId',
      '#lastConnectionDay': 'lastConnectionDay'
    },
    ExpressionAttributeValues: {
      ':connectionId': connectionId,
      ':today': (new Date()).toISOString().split('T')[0]
    }
  }))

  if (typeof groupId === 'string') {
    try {
      const { group: { isPublic }, users } = await getGroup({ groupId })
      if (isPublic) {
        await Promise.allSettled([
          sendMessages({
            users: users.filter(({ id: userId }) => (userId !== id)),
            message: {
              action: 'connect',
              id
            },
            useSaveMessage: false
          })
        ]).then((results) => (console.log(results)))
      }
    } catch (error) {
      if (error.message !== `group (${groupId}) is not defined`) {
        throw error
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ id, connectionId })
  }
}
