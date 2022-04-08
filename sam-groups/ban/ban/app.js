// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const { sendToConnectionId, getConnectionId, getUsers } = require('helpers')

const { USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, SWITCH_GROUP_LAMBDA_ARN, AWS_REGION } = process.env

const ddb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION })
const lambda = new AWS.Lambda({ region: AWS_REGION })

exports.handler = async (event) => {
  console.log(`Receives:\n\tEvent:\n${event}`)

  // banneduserid
  const banneduserid = event.banneduserid

  // groupid
  const groupid = event.groupid

  // endpoint
  const endpoint = event.endpoint

  // status
  const status = event.status

  if (status !== 'confirmed' && status !== 'denied') {
    console.log(`Status (${status}) has to be "confirmed" or "denied".`)
    throw Error('status not allowed')
  }

  // TODO: verify banned is legitimate (already verified in banreply, but you're never too prudent)
  // get banned user
  const banneduser = await ddb.get({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    AttributesToGet: ['id']
  }).Item

  // verify banned user exists
  if (!banneduser) {
    console.log(`User ${banneduserid} is not in a ban vote. Returns`)
    return
  }

  // get groups before the switch (groups will change)
  const users = await getUsers(GROUPS_TABLE_NAME, groupid, ddb)

  // connectionIds
  const connectionIds = await getConnectionId(USERS_TABLE_NAME, users, ddb)
  console.log(`\tConnection ids:\n${JSON.stringify(connectionIds)}`)

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: endpoint
  })

  let Data

  switch (status) {
    case 'confirmed':
      // switch group and inform users in parallel
      // switchgroup
      lambda.invoke({
        FunctionName: SWITCH_GROUP_LAMBDA_ARN,
        InvocationType: 'Event',
        Paryload: JSON.stringify({
          body: {
            userid: banneduserid
          }
        })
      })

      // inform users
      Data = { action: 'banconfirmed', data: { banneduserid: banneduserid } }
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
      Data = { action: 'bandenied', data: { banneduserid: banneduserid } }
      break
    default:
      console.log(`Status (${status}) has to be "confirmed" or "denied".`)
      throw Error('status not allowed')
  }

  const postCalls = connectionIds.map(async ({ id, connectionId }) => {
    await sendToConnectionId(USERS_TABLE_NAME, id, connectionId, apigwManagementApi, ddb, Data)
  })
  await Promise.all(postCalls)

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify(`Bann user ${banneduserid} - ${status}!`)
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
