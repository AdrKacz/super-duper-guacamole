// user in group
exports.getUsers = async (GROUPS_TABLE_NAME, groupid, ddb) => {
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
exports.getConnectionIds = async (USERS_TABLE_NAME, users, ddb) => {
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

exports.sendToUsers = async (USERS_TABLE_NAME, users, apigwManagementApi, ddb, Data) => {
  console.log(`Send Data:\n${JSON.stringify(Data)}\nTo users:\n${JSON.stringify(users)}`)

  const request = await ddb.batchGet({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: users.map(u => ({ id: u })),
        AttributesToGet: ['id', 'connectionId']
      }
    }
  }).promise()

  console.log(`Request:\n${JSON.stringify(request)}`)

  const usersConnectionIds = request.Responses[USERS_TABLE_NAME]

  return usersConnectionIds.map(async ({ id, connectionId }) => {
    try {
      console.log(`<${id}> + ConnectionId <${connectionId}>`)
      if (connectionId === undefined) {
        const error = Error(`Connection Id of user <${id}> is not defined.`)
        error.statusCode = 410 // to be handle
        throw error
      }
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(Data) }).promise()
    } catch (e) {
      console.log(`<${id}> ++ Did not succeed, error ${e.statusCode}:\n${JSON.stringify(e)}`)
      if (e.statusCode === 410) {
        console.log(`<${id}> +++ Found stale connection, deleting ${connectionId} and add Data to remaining message for user ${id}`)
        // NOTE: could use BatchWrite instead
        await ddb.update({
          TableName: USERS_TABLE_NAME,
          Key: { id: id },
          AttributeUpdates: {
            connectionId: {
              Action: 'DELETE'
            },
            unreadData: {
              Action: 'ADD',
              Value: [Data]
            }
          }
        }).promise()
      } else {
        throw e
      }
    }
  })
}

// send a message to a connection over an api web socket and update connection if not found
exports.sendToConnectionId = async (USERS_TABLE_NAME, userid, connectionId, apigwManagementApi, ddb, Data) => {
  try {
    console.log(`Try to send to ${connectionId}:\n${JSON.stringify(Data)}`)
    await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(Data) }).promise()
    return { userid: userid }
  } catch (e) {
    if (e.statusCode === 410) {
      console.log(`\tFound stale connection, deleting ${connectionId}`)
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

// switchgroup
exports.switchGroup = async (USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, userid, ddb) => {
  // get old group
  let groupid
  let connectionId
  console.log(`Try get user users:id:${userid}`)
  const user = await ddb.get({
    TableName: USERS_TABLE_NAME,
    Key: { id: userid },
    AttributesToGet: ['id', 'group', 'connectionId']
  }).promise()
  console.log(`\tUser:\n${JSON.stringify(user)}`)

  // verify userid exists
  if (!user.Item) {
    throw new Error(`Error: user ${userid} not found.`)
  } else {
    groupid = user.Item.group
    connectionId = user.Item.connectionId
  }

  // remove and delete in parallel
  // remove from old group
  if (groupid) {
    // update group
    console.log(`Try update group ${groupid} - DELETE groups:users:${userid}`)
    await ddb.update({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: groupid },
      AttributeUpdates: {
        users: {
          Action: 'DELETE',
          Value: ddb.createSet([userid])
        }
      }
    }).promise()
  }

  // remove potential ban
  console.log(`Try update user ${userid} - DELETE bannedusers:${userid}`)
  await ddb.delete({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: {
      id: userid
    }
  }).promise()

  // new groupid
  // (avoid being in the same group)
  // (between 0 and 9)
  // (random between 0 and 8 to avoid collision)
  const randomgroup = Math.floor(Math.random() * 9).toString()
  if (randomgroup === groupid) {
    groupid = (parseInt(randomgroup) + 1).toString()
  } else {
    groupid = randomgroup
  }

  // TODO: revert users and groups on error
  // update group
  console.log(`Try update group ${groupid} - ADD groups:users:${userid}`)
  await ddb.update({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupid },
    AttributeUpdates: {
      users: {
        Action: 'ADD',
        Value: ddb.createSet([userid])
      }
    }
  }).promise()

  // update user
  console.log(`Try update user ${userid} - PUT users:group:${groupid}`)
  await ddb.update({
    TableName: USERS_TABLE_NAME,
    Key: { id: userid },
    AttributeUpdates: {
      group: {
        Action: 'PUT',
        Value: groupid
      },
      unreadData: {
        Action: 'DELETE'
      }
    }
  }).promise()

  return { userid: userid, groupid: groupid, connectionId: connectionId }
}

// ban user
exports.ban = async (USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, banneduserid, groupid, status, ddb) => {
  if (status !== 'confirmed' && status !== 'denied') {
    console.log(`Status (${status}) has to be "confirmed" or "denied".`)
    throw Error('status not allowed')
  }

  // TODO: verify banned is legitimate (already verified in banreply, but you're never too prudent)
  // NOTE: request result never used, just to verify banned user is still in a vote
  const request = await ddb.get({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    AttributesToGet: ['id']
  }).promise()

  // verify banned user exists
  if (!request.Item) {
    console.log(`User ${banneduserid} is not in a ban vote. Returns`)
    return
  }

  // get groups before the switch (groups will change)
  const users = await exports.getUsers(GROUPS_TABLE_NAME, groupid, ddb)

  let Data
  let banneduser
  switch (status) {
    case 'confirmed':
      // switch group and inform users in parallel
      // switchgroup
      banneduser = await exports.switchGroup(USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, banneduserid, ddb)

      // inform users
      Data = { action: 'banconfirmed', banneduserid: banneduserid }
      break
    case 'denied':
      // remove ban user
      console.log(`Try update user ${banneduserid} - DELETE bannedusers:${banneduserid}`)
      await ddb.delete({
        TableName: BANNED_USERS_TABLE_NAME,
        Key: {
          id: banneduserid
        }
      }).promise()

      // inform users
      Data = { action: 'bandenied', banneduserid: banneduserid }
      break
    default:
      console.log(`Status (${status}) has to be "confirmed" or "denied".`)
      throw Error('status not allowed')
  }

  return { users, banneduser, Data }
}
