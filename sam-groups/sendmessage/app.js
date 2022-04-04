// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

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

  // connectionId
  // const userConnectionId = event.requestContext.connectionId

  // get users
  let users
  console.log(`Try get users groups:id:${groupid}`)
  const group = await ddb.get({
    TableName: GROUPS_TABLE_NAME,
    Key: { id: groupid },
    AttributesToGet: ['id', 'users']
  }).promise()
  console.log(`\tgroup:\n${JSON.stringify(group)}`)
  // verify groupid exists
  if (!group.Item) {
    throw new Error(`Error: group ${groupid} not found.`)
  } else {
    users = group.Item.users.values
  }

  // TODO: verify userid is in group
  // connectionIds
  console.log(`Try get users:connectionIds ids:${JSON.stringify(users)}`)
  const groupusers = await ddb.batchGet({
    RequestItems: {
      [USERS_TABLE_NAME]: {
        Keys: users.map(u => ({ id: u })),
        AttributesToGet: ['id', 'connectionId']
      }
    }
  }).promise()
  const connectionIds = groupusers.Responses[USERS_TABLE_NAME].filter(({ connectionId }) => connectionId !== undefined)
  console.log(`\tConnection ids:\n${JSON.stringify(connectionIds)}`)

  // broadcast
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  })

  const postCalls = connectionIds.map(async ({ id, connectionId }) => {
    try {
      console.log(`Try connection ${connectionId}`)
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify({ action: 'sendmessage', data: data }) }).promise()
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`)
        await ddb.update({
          TableName: USERS_TABLE_NAME,
          Key: { id: id },
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
  })

  try {
    await Promise.all(postCalls)
  } catch (e) {
    return { statusCode: 500, body: e.stack }
  }

  // notification
  lambda.invoke({
    FunctionName: NOTIFICATION_LAMBDA_ARN,
    InvocationType: 'RequestResponse',
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
