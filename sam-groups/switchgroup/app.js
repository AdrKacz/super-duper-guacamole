// Lambda use AWS SDK v2 by default

const { sendToConnectionId } = require('helpers')

const AWS = require('aws-sdk')

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const { USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME } = process.env

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  // NOTE: use connectionIs as a second index to not have to send userid
  // TODO: throw an error if userid is undefined
  const userid = body.userid

  // request connectionId
  // TODO: verify connectionId belong to user
  // const requestConnectionId = event.requestContext.connectionId

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

  // NOTE: commented to note throw an error when invoked by ban lambda
  // if (requestConnectionId !== connectionId) {
  //   throw Error(`Request from connection ${requestConnectionId} for different connection ${connectionId}`)
  // }

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
  groupid = Math.floor(Math.random() * 10).toString()

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
      }
    }
  }).promise()

  // inform user of its new group
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  })

  await sendToConnectionId(USERS_TABLE_NAME, userid, connectionId, apigwManagementApi, ddb, { action: 'switchgroup', groupid: groupid })

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify('Switch group!')
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
