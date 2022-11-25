
// ===== ==== ====
// IMPORTS
const { USERS_TABLE_NAME } = process.env

const { dynamoDBDocumentClient } = require('chat-backend-package/src/clients/aws/dynamo-db-client') // skipcq: JS-0260
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { getGroup } = require('chat-backend-package/src/get-group') // skipcq: JS-0260
const { getUser } = require('chat-backend-package/src/get-user') // skipcq: JS-0260
const { sendMessages } = require('chat-backend-package/src/send-messages') // skipcq: JS-0260

// ===== ==== ====
// HANDLER
/**
 * Store the last day of connection
 * Disconnect may not be called everytime
 * Resulting in false "Connected" state
 * How to remediate it?
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2))

  const { id, groupId } = await getUser({ id: event.requestContext.authorizer.id })

  // update user
  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    UpdateExpression: 'REMOVE #connectionId',
    ConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: { '#connectionId': 'connectionId' },
    ExpressionAttributeValues: { ':connectionId': event.requestContext.connectionId }
  }))

  if (typeof groupId === 'string') {
    try {
      const { group: { isPublic }, users } = await getGroup({ groupId })
      if (!isPublic) {
        await sendMessages({
          users: users.filter(({ id: userId }) => (userId !== id)),
          message: {
            action: 'disconnect',
            id
          },
          useSaveMessage: false
        })
      }
    } catch (error) {
      if (error.message !== `group (${groupId}) is not defined`) {
        throw error
      }
    }
  }
}
