const {
  getDynamoDBDocumentClient,
  getApiGatewayManagementApiClient,
  sendToUsers,
  getGroupUsers
} = require('helpers')

const { sendNotification } = require('notification')

const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  FIREBASE_SERVICE_ACCOUNT_KEY,
  AWS_REGION
} = process.env

const dynamoDBDocumentClient = getDynamoDBDocumentClient(AWS_REGION)

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  // NOTE: use connectionIs as a second index to not have to send userid
  // TODO: verify userid with connectionId
  // TODO: throw an error if userid is undefined
  // const userid = body.userid

  // groupid
  // TODO: get group from USERS_TABLE
  const groupid = body.groupid

  // data
  // TODO: throw an error if data is undefined
  const data = body.data

  // users
  // TODO: verify userid is in group
  const users = await getGroupUsers(GROUPS_TABLE_NAME, groupid, dynamoDBDocumentClient)
  console.log(`\tUsers:\n${JSON.stringify(users)}`)

  // broadcast data
  const apiGatewayManagementApiClient = getApiGatewayManagementApiClient(
    AWS_REGION,
    {
      protocol: 'https',
      hostname: event.requestContext.domainName,
      path: event.requestContext.stage
    }
  )

  await Promise.all(await sendToUsers(USERS_TABLE_NAME, users, apiGatewayManagementApiClient, dynamoDBDocumentClient, { action: 'sendmessage', data: data }))

  // notification
  sendNotification(
    FIREBASE_SERVICE_ACCOUNT_KEY,
    {
      title: 'Les gens parlent 🎉',
      body: 'Tu es trop loin pour entendre ...'
    },
    `group-${groupid}`
  )

  // debug
  const lambdaResponse = {
    statusCode: 200,
    body: JSON.stringify(`Send message!\n${JSON.stringify({ data: data })}`)
  }

  console.log(`Returns:\n${JSON.stringify(lambdaResponse)}`)
  return lambdaResponse
}
