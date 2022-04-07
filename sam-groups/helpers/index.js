// user in group
module.exports.getUsers = async (GROUPS_TABLE_NAME, groupid, ddb) => {
  let users
  console.log(`Try get users groups:id:${groupid}`)
  const group = await ddb.get({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupid },
    AttributesToGet: ['id', 'users']
  }).promise()
  // verify groupid exists
  if (!group.Item) {
    throw new Error(`Error: group ${groupid} not found.`)
  } else {
    users = group.Item.users.values
  }
  return users
}

// connectionIds in a group
module.exports.getConnectionId = async (USERS_TABLE_NAME, users, ddb) => {
  // connectionIds
  const groupusers = await ddb.batchGet({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: users.map(u => ({ id: u })),
        AttributesToGet: ['id', 'connectionId']
      }
    }
  }).promise()
  return groupusers.Responses[USERS_TABLE_NAME].filter(({ connectionId }) => connectionId !== undefined)
}

// send a message to a connection over an api web socket and update connection if not found
module.exports.sendToConnectionId = async (USERS_TABLE_NAME, userid, connectionId, apigwManagementApi, ddb, Data) => {
  try {
    console.log(`Try connection ${connectionId}`)
    await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(Data) }).promise()
    return { userid: userid }
  } catch (e) {
    if (e.statusCode === 410) {
      console.log(`Found stale connection, deleting ${connectionId}`)
      await ddb.update({
        TableName: USERS_TABLE_NAME,
        Key: { id: userid },
        AttributeUpdates: {
          connectionId: {
            Action: 'DELETE'
          }
        }
      }).promise()
    } else {
      throw e
    }
  }
  return {}
}
