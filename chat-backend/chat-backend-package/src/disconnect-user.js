// ===== ==== ====
// IMPORTS
const { USERS_TABLE_NAME } = process.env

const { dynamoDBDocumentClient } = require('./clients/aws/dynamo-db-client') // skipcq: JS-0260
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { getGroup } = require('./get-group') // skipcq: JS-0260
const { getUser } = require('./get-user') // skipcq: JS-0260
const { sendMessages } = require('./send-messages') // skipcq: JS-0260

// ===== ==== ====
// EXPORTS
/**
 * Disconnect user with its id
 * Needs its connection id to be sure the connexion hasn't been replaced since
 *
 * @param {string} id
 * @param {string} id
 *
 * @return {Promise<User>}
 */
exports.disconnectUser = async ({ id, connectionId }) => {
  // update user
  await dynamoDBDocumentClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'REMOVE #connectionId',
    ConditionExpression: '#connectionId = :connectionId',
    ExpressionAttributeNames: { '#connectionId': 'connectionId' },
    ExpressionAttributeValues: { ':connectionId': connectionId }
  }))

  const { groupId } = await getUser({ id })

  if (typeof groupId === 'string') {
    try {
      const { group: { isPublic }, users } = await getGroup({ groupId })
      if (isPublic) {
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
