// ===== ==== ====
// IMPORTS
const { GetCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { dynamoDBDocumentClient } = require('../clients/aws/dynamo-db-client')

const { GROUPS_TABLE_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get group metadata (don't fetch the users)
 *
 * @param {string} groupId
 *
 * @return {Promise<Group>} - add type definition somewhere
 */
exports.getGroupMetadata = async ({ groupId }) => {
  console.log(`get group (${groupId}) metadata`)

  const getGroupCommand = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupId }
  })
  const group = await dynamoDBDocumentClient.send(getGroupCommand).then((response) => (response.Item))

  if (typeof group !== 'object') {
    throw new Error(`group (${groupId}) is not defined`)
  }

  group.isPublic = typeof group.isPublic === 'boolean' ? group.isPublic : true
  console.log('group', group)

  return group
}
