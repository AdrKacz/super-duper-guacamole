// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const { USERS_TABLE_NAME } = process.env

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  // TODO: throw an error if userid is undefined
  const userid = body.userid

  // connectionId
  const connectionId = event.requestContext.connectionId

  // update user
  console.log(`Try update users:id:${userid}`)
  await ddb.update({
    TableName: USERS_TABLE_NAME,
    Key: { id: userid },
    AttributeUpdates: {
      connectionId: {
        Action: 'PUT',
        Value: event.requestContext.connectionId
      }
    }
  }).promise()

  // return
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  })

  try {
    console.log(`Try connection ${connectionId}`)
    await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: 'register' }).promise()
  } catch (e) {
    if (e.statusCode === 410) {
      console.log(`Found stale connection, deleting ${connectionId}`)
    } else {
      throw e
    }
  }

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify('Registered!')
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
