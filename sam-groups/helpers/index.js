// ===== ===== =====
// AWS-SDK
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')

const {
  DynamoDBDocumentClient,
  GetCommand, BatchGetCommand,
  UpdateCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb')

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} = require('@aws-sdk/client-apigatewaymanagementapi')

const {
  LambdaClient,
  InvokeCommand
} = require('@aws-sdk/client-lambda')

exports.getDynamoDBDocumentClient = (AWS_REGION) => {
  const client = new DynamoDBClient({ region: AWS_REGION })
  return DynamoDBDocumentClient.from(client)
}

exports.getApiGatewayManagementApiClient = (AWS_REGION, endpoint) => {
  return new ApiGatewayManagementApiClient({
    region: AWS_REGION,
    endpoint: endpoint
  })
}

exports.getLambdaClient = (AWS_REGION) => {
  return new LambdaClient({ region: AWS_REGION })
}

// ===== ===== =====
// HELPERS AWS
exports.getItem = async (commandInput, dynamoDBDocumentClient) => {
  const command = new GetCommand(commandInput)
  return await dynamoDBDocumentClient.send(command)
}

exports.updateItem = async (commandInput, dynamoDBDocumentClient) => {
  const command = new UpdateCommand(commandInput)
  return await dynamoDBDocumentClient.send(command)
}

exports.invoke = async (commandInput, lambdaClient) => {
  const command = new InvokeCommand(commandInput)
  return await lambdaClient.send(command)
}

// ===== ===== =====
// HELPERS FUNCTION

// user in group
exports.getGroupUsers = async (GROUPS_TABLE_NAME, groupid, dynamoDBDocumentClient) => {
  let users
  console.log(`Try get users groups:id:${groupid}`)
  const command = new GetCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupid },
    ProjectionExpression: '#i, #u',
    ExpressionAttributeNames: {
      '#i': 'id',
      '#u': 'users'
    }
  })
  const response = await dynamoDBDocumentClient.send(command)

  console.log(`Receive response:\n${JSON.stringify(response)}\nBelow response.Item.users (without JSON.stringify)`)
  console.log(response.Item.users)
  // verify groupid exists
  if (!response.Item) {
    throw new Error(`Error: group ${groupid} not found.`)
  } else {
    users = Array.from(response.Item.users)
  }
  return users
}

// connectionIds in a group
exports.getUsersConnectionIds = async (USERS_TABLE_NAME, users, dynamoDBDocumentClient) => {
  // connectionIds
  const command = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: users.map(u => ({ id: u })),
        ProjectionExpression: '#i, #ci',
        ExpressionAttributeNames: {
          '#i': 'id',
          '#ci': 'connectionId'
        }
      }
    }
  })
  const response = await dynamoDBDocumentClient.send(command)

  return response.Responses[USERS_TABLE_NAME].filter(({ connectionId }) => connectionId !== undefined)
}

exports.sendToUsers = async (USERS_TABLE_NAME, users, apiGatewayManagementApiClient, dynamoDBDocumentClient, Data) => {
  console.log(`Send Data:\n${JSON.stringify(Data)}\nTo users:\n${JSON.stringify(users)}`)

  const command = new BatchGetCommand({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: users.map(u => ({ id: u })),
        ProjectionExpression: '#i, #ci',
        ExpressionAttributeNames: {
          '#i': 'id',
          '#ci': 'connectionId'
        }
      }
    }
  })
  const response = await dynamoDBDocumentClient.send(command)

  console.log(`Request:\n${JSON.stringify(response)}`)

  const usersConnectionIds = response.Responses[USERS_TABLE_NAME]

  // NOTE: could BatchWrite to all unconnected users
  return usersConnectionIds.map(async ({ id, connectionId }) => {
    exports.sendToUser(USERS_TABLE_NAME, id, connectionId, apiGatewayManagementApiClient, dynamoDBDocumentClient, Data)
  })
}

// send a message to a connection over an api web socket, update connection and store if not found
exports.sendToUser = async (USERS_TABLE_NAME, id, connectionId, apiGatewayManagementApiClient, dynamoDBDocumentClient, Data) => {
  try {
    console.log(`<${id}> + ConnectionId <${connectionId}>`)
    if (connectionId === undefined) {
      const error = Error(`ConnectionId of user <${id}> is not defined.`)
      error.statusCode = 410 // will be handle
      throw error
    }
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(Data)
    })
    await apiGatewayManagementApiClient.send(command)
  } catch (e) {
    console.log(`<${id}> ++ Did not succeed, error ${e.statusCode}:\n${JSON.stringify(e)}`)
    if (e.statusCode === 410) {
      console.log(`<${id}> +++ Found stale connection, deleting ${connectionId} and add Data to remaining message for user ${id}`)
      const command = new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: id },
        UpdateExpression: `
        REMOVE #ci
        SET #ud = list_append(#ud, :data)
        `,
        ExpressionAttributeNames: {
          '#ci': 'connectionId'
        },
        ExpressionAttributeValues: {
          ':data': [Data]
        }
      })
      await dynamoDBDocumentClient.send(command)
    } else {
      throw e
    }
  }
}

// send a message to a connection over an api web socket and update connection if not found (do not store if not found)
exports.sendToActiveUser = async (USERS_TABLE_NAME, userid, connectionId, apiGatewayManagementApiClient, dynamoDBDocumentClient, Data) => {
  try {
    console.log(`Try to send to ${connectionId}:\n${JSON.stringify(Data)}`)
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(Data)
    })
    await apiGatewayManagementApiClient.send(command)
    return { userid: userid }
  } catch (e) {
    if (e.statusCode === 410) {
      console.log(`\tFound stale connection, deleting ${connectionId}`)
      const command = new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { id: userid },
        UpdateExpression: `
        REMOVE #ci
        `,
        ExpressionAttributeNames: {
          '#ci': 'connectionId'
        }
      })
      await dynamoDBDocumentClient.send(command)
    } else {
      throw e
    }
  }
  return {}
}

// switchgroup
exports.switchUserGroup = async (USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, id, dynamoDBDocumentClient) => {
  // get old group
  let groupid
  let connectionId
  console.log(`Try get user users:id:${id}`)
  const getCommand = new GetCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    ProjectionExpression: '#i, #g, #ci',
    ExpressionAttributeNames: {
      '#i': 'id',
      '#g': 'group',
      '#ci': 'connectionId'
    }
  })
  const response = await dynamoDBDocumentClient.send(getCommand)
  console.log(`\tUser:\n${JSON.stringify(response)}`)

  // verify userid exists
  if (!response.Item) {
    throw new Error(`Error: user ${id} not found.`)
  } else {
    groupid = response.Item.group
    connectionId = response.Item.connectionId
  }

  // remove and delete in parallel
  // remove from old group
  if (groupid) {
    // update group
    console.log(`Try update group ${groupid} - DELETE groups:users:${id}`)
    const command = new UpdateCommand({
      TableName: GROUPS_TABLE_NAME,
      Key: { id: groupid },
      UpdateExpression: `
      DELETE #u :i
      `,
      ExpressionAttributeNames: {
        '#u': 'users'
      },
      ExpressionAttributeValues: {
        ':i': new Set([id])
      }
    })
    await dynamoDBDocumentClient.send(command)
  }

  // remove potential ban
  console.log(`Try update user ${id} - DELETE bannedusers:${id}`)
  const deleteCommand = new DeleteCommand({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: {
      id: id
    }
  })
  await dynamoDBDocumentClient.send(deleteCommand)

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
  console.log(`Try update group ${groupid} - ADD groups:users:${id}`)
  const updateGroupCommand = new UpdateCommand({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupid },
    UpdateExpression: `
    ADD #u :i
    `,
    ExpressionAttributeNames: {
      '#u': 'users'
    },
    ExpressionAttributeValues: {
      ':i': new Set([id])
    }
  })
  await dynamoDBDocumentClient.send(updateGroupCommand)

  // update user
  console.log(`Try update user ${id} - PUT users:group:${groupid}`)
  const updateUserCommand = new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { id: id },
    UpdateExpression: `
    REMOVE #ud
    SET #g = :i
    `,
    ExpressionAttributeNames: {
      '#ud': 'unreadData',
      '#g': 'group'
    },
    ExpressionAttributeValues: {
      ':i': groupid
    }
  })
  await dynamoDBDocumentClient.send(updateUserCommand)

  return { id: id, groupid: groupid, connectionId: connectionId }
}

// ban user
exports.ban = async (USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, banneduserid, groupid, status, dynamoDBDocumentClient) => {
  if (status !== 'confirmed' && status !== 'denied') {
    console.log(`Status (${status}) has to be "confirmed" or "denied".`)
    throw Error('status not allowed')
  }

  // TODO: verify banned is legitimate (already verified in banreply, but you're never too prudent)
  // NOTE: request result never used, just to verify banned user is still in a vote
  const command = new GetCommand({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    ProjectionExpression: '#i',
    ExpressionAttributeNames: {
      '#i': 'id'
    }
  })
  const response = await dynamoDBDocumentClient.send(command)

  // verify banned user exists
  if (!response.Item) {
    console.log(`User ${banneduserid} is not in a ban vote. Returns`)
    return
  }

  // get groups before the switch (groups will change)
  const users = await exports.getGroupUsers(GROUPS_TABLE_NAME, groupid, dynamoDBDocumentClient)

  let Data
  let banneduser
  switch (status) {
    case 'confirmed':
      // switch group and inform users in parallel
      // switchgroup
      banneduser = await exports.switchUserGroup(USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, banneduserid, dynamoDBDocumentClient)

      // inform users
      Data = { action: 'banconfirmed', banneduserid: banneduserid }
      break
    case 'denied':
      // remove ban user
      console.log(`Try update user ${banneduserid} - DELETE bannedusers:${banneduserid}`)
      // eslint-disable-next-line no-case-declarations
      const command = new DeleteCommand({
        TableName: BANNED_USERS_TABLE_NAME,
        Key: {
          id: banneduserid
        }
      })
      await dynamoDBDocumentClient.send(command)

      // inform users
      Data = { action: 'bandenied', banneduserid: banneduserid }
      break
    default:
      console.log(`Status (${status}) has to be "confirmed" or "denied".`)
      throw Error('status not allowed')
  }

  return { users, banneduser, Data }
}
