const {
  getDynamoDBDocumentClient,
  updateItem,
  getApiGatewayManagementApiClient,
  sendToUser
} = require('helpers')

const {
  AWS_REGION,
  USERS_TABLE_NAME
} = process.env

const dynamoDBDocumentClient = getDynamoDBDocumentClient(AWS_REGION)

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
  const commandInput = {
    ReturnValues: 'ALL_OLD',
    TableName: USERS_TABLE_NAME,
    Key: { id: userid },
    UpdateExpression: `
    REMOVE #ur
    SET #ci = :v
    `,
    ExpressionAttributeNames: {
      '#ur': 'unreadData',
      '#ci': 'connectionId'
    },
    ExpressionAttributeValues: {
      ':v': event.requestContext.connectionId
    }
  }
  console.log(`Try update users:id:${userid} with command input:\n${JSON.stringify(commandInput)}`)
  const response = await updateItem(
    commandInput,
    dynamoDBDocumentClient
  )

  console.log(`Get user:\n${JSON.stringify(response)}`)

  const unreadData = []
  if (response.Attributes !== undefined && response.Attributes.unreadData !== undefined) {
    unreadData.push(...response.Attributes.unreadData)
  }

  // return
  const apiGatewayManagementApiClient = getApiGatewayManagementApiClient(
    AWS_REGION,
    {
      protocol: 'https',
      hostname: event.requestContext.domainName,
      path: event.requestContext.stage
    }
  )

  await sendToUser(USERS_TABLE_NAME, userid, connectionId, apiGatewayManagementApiClient, dynamoDBDocumentClient, { action: 'register', status: 'success', unread: unreadData })

  // debug
  const lambdaResponse = {
    statusCode: 200,
    body: JSON.stringify('Registered!')
  }

  console.log(`Returns:\n${JSON.stringify(lambdaResponse)}`)
  return lambdaResponse
}
