// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const { getConnectionId, sendToConnectionId, getUsers } = require('helpers')

const { USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, AWS_REGION } = process.env

const ddb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION })

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  // const userid = body.userid

  // banuserid
  const banneduserid = body.banneduserid

  // groupid
  const groupid = body.groupid

  // messageid
  const messageid = body.messageid

  // users
  const users = await getUsers(GROUPS_TABLE_NAME, groupid, ddb)
  console.log(`\tUsers:\n${JSON.stringify(users)}`)

  // connectionIds
  // TODO: verify userid and banuserid are in group
  const connectionIds = await getConnectionId(USERS_TABLE_NAME, users, ddb)
  console.log(`\tConnection ids:\n${JSON.stringify(connectionIds)}`)

  // broadcast request to everyone but banneduserid
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  })

  const postCalls = connectionIds.filter(({ id }) => id !== banneduserid).map(async ({ id, connectionId }) => {
    return await sendToConnectionId(USERS_TABLE_NAME, id, connectionId, apigwManagementApi, ddb, { action: 'banrequest', messageid: messageid })
  })

  const useridsStatus = await Promise.all(postCalls)
  const votingUserids = useridsStatus.filter(({ userid }) => userid !== undefined).map(({ userid }) => userid)
  console.log('Voting userids:', votingUserids)

  // update banneduser
  if (votingUserids.length > 0) {
    console.log(`Try update users:id:${banneduserid}`)
    await ddb.update({
      TableName: BANNED_USERS_TABLE_NAME,
      Key: { id: banneduserid },
      AttributeUpdates: {
        votingUsers: {
          Action: 'ADD',
          Value: ddb.createSet(votingUserids)
        }
      }
    }).promise()
  } else {
    console.log('No voting users ... this should not happen')
  }

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify('Ban request done!')
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
