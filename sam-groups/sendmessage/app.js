// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const { sendToUsers, getUsers } = require('helpers')

const { USERS_TABLE_NAME, GROUPS_TABLE_NAME, NOTIFICATION_LAMBDA_ARN, AWS_REGION } = process.env

const ddb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION })
const lambda = new AWS.Lambda({ region: AWS_REGION })

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
  const users = await getUsers(GROUPS_TABLE_NAME, groupid, ddb)
  console.log(`\tUsers:\n${JSON.stringify(users)}`)

  // broadcast data
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  })

  await Promise.all(await sendToUsers(USERS_TABLE_NAME, users, apigwManagementApi, ddb, { action: 'sendmessage', data: data }))

  // notification
  lambda.invoke({
    FunctionName: NOTIFICATION_LAMBDA_ARN,
    Payload: JSON.stringify({ groupid: groupid })
  }, (err, data) => {
    if (err) console.log(err, err.stack) // an error occurred
    else console.log(data)
  })

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify(`Send message!\n${JSON.stringify({ data: data })}`)
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
