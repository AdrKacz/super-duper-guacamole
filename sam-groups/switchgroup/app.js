// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const { sendToConnectionId, switchGroup } = require('helpers')

const { USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, AWS_REGION } = process.env

const ddb = new AWS.DynamoDB.DocumentClient({ AWS_REGION })

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  // NOTE: use connectionIs as a second index to not have to send userid
  // TODO: verify user.connectionId and connectionId are the same
  const userid = body.userid

  const user = await switchGroup(USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, userid, ddb)

  // inform user of its new group
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  })

  await sendToConnectionId(USERS_TABLE_NAME, userid, user.connectionId, apigwManagementApi, ddb, { action: 'switchgroup', groupid: user.groupid })

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify('Switch group!')
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
