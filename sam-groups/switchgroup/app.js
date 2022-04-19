const {
  getDynamoDBDocumentClient,
  getApiGatewayManagementApiClient,
  sendToUser,
  switchUserGroup
} = require('helpers')

const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  BANNED_USERS_TABLE_NAME,
  AWS_REGION
} = process.env

const dynamoDBDocumentClient = getDynamoDBDocumentClient(AWS_REGION)

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  // NOTE: use connectionIs as a second index to not have to send userid
  // TODO: verify user.connectionId and connectionId are the same
  const userid = body.userid

  const user = await switchUserGroup(USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, userid, dynamoDBDocumentClient)

  // inform user of its new group
  const apiGatewayManagementApiClient = getApiGatewayManagementApiClient(
    AWS_REGION,
    {
      protocol: 'https',
      hostname: event.requestContext.domainName,
      path: event.requestContext.stage
    }
  )

  await sendToUser(USERS_TABLE_NAME, userid, user.connectionId, apiGatewayManagementApiClient, dynamoDBDocumentClient, { action: 'switchgroup', groupid: user.groupid })

  // debug
  const lambdaResponse = {
    statusCode: 200,
    body: JSON.stringify('Switch group!')
  }

  console.log(`Returns:\n${JSON.stringify(lambdaResponse)}`)
  return lambdaResponse
}
