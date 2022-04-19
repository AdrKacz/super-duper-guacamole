const {
  getDynamoDBDocumentClient,
  getApiGatewayManagementApiClient,
  getItem,
  updateItem,
  getGroupUsers,
  getUsersConnectionIds,
  sendToActiveUser
} = require('helpers')

const {
  USERS_TABLE_NAME,
  GROUPS_TABLE_NAME,
  BANNED_USERS_TABLE_NAME,
  CONFIRMATION_REQUIRED_STRING,
  AWS_REGION
} = process.env

const CONFIRMATION_REQUIRED = parseInt(CONFIRMATION_REQUIRED_STRING)

const dynamoDBDocumentClient = getDynamoDBDocumentClient(AWS_REGION)

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  const userid = body.userid

  // banneduserid
  const banneduserid = body.banneduserid

  // groupid
  const groupid = body.groupid

  // messageid
  const messageid = body.messageid

  // get banned user if any
  const response = await getItem({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    ProjectionExpression: '#i, #vu, #cu',
    ExpressionAttributeNames: {
      '#i': 'id',
      '#vu': 'votingUsers',
      '#cu': 'confirmedUsers'
    }
  },
  dynamoDBDocumentClient
  )

  let votingUsers = new Set()
  let confirmedUsers = new Set()
  if (response.Item) {
    console.log(`User ${banneduserid} was already in a ban vote`)
    votingUsers = response.Item.votingUsers ?? new Set()
    confirmedUsers = response.Item.confirmedUsers ?? new Set()
    console.log('\tVoting Users below (without JSON.stringigy)\n')
    console.log(votingUsers)
    console.log('\tConfirme Users Users below (without JSON.stringigy)\n')
    console.log(confirmedUsers)
  }

  // users
  const users = await getGroupUsers(GROUPS_TABLE_NAME, groupid, dynamoDBDocumentClient)
  console.log(`\tUsers:\n${JSON.stringify(users)}`)

  // verify userid and banuserid are in group
  if (!users.includes(userid) || !users.includes(banneduserid)) {
    console.log(`\tUser ${userid} and Banned User ${banneduserid} are not both in group:\n${JSON.stringify(users)}`)
    return {
      statusCode: 200,
      body: JSON.stringify('Ban request denied!')
    }
  }

  // connectionIds
  // TODO: verify userid and banuserid are in group
  const connectionIds = await getUsersConnectionIds(USERS_TABLE_NAME, users, dynamoDBDocumentClient)
  console.log(`\tConnection ids:\n${JSON.stringify(connectionIds)}`)

  const apiGatewayManagementApiClient = getApiGatewayManagementApiClient(
    AWS_REGION,
    {
      protocol: 'https',
      hostname: event.requestContext.domainName,
      path: event.requestContext.stage
    }
  )

  // broadcast request to everyone
  let remainingConnectionIds = connectionIds
  // but banneduserid
  remainingConnectionIds = remainingConnectionIds.filter(({ id }) => id !== banneduserid)
  // (for multiple ban request for the same user)
  // but users who have already confirmed
  remainingConnectionIds = remainingConnectionIds.filter(({ id }) => !confirmedUsers.has(id))
  // but users who are still voting
  remainingConnectionIds = remainingConnectionIds.filter(({ id }) => !votingUsers.has(id))
  // (don't remove users who have denied)

  console.log(`\tRemaining connection ids:\n${JSON.stringify(connectionIds)}`)
  const postCalls = remainingConnectionIds.map(async ({ id, connectionId }) => {
    return await sendToActiveUser(USERS_TABLE_NAME, id, connectionId, apiGatewayManagementApiClient, dynamoDBDocumentClient, { action: 'banrequest', messageid: messageid })
  })

  // retreive voting userids
  const useridsStatus = await Promise.all(postCalls)
  const votingUserids = useridsStatus.filter(({ userid }) => userid !== undefined).map(({ userid }) => userid)
  console.log('Voting userids:', votingUserids)

  // update banneduser (votingUsers AND confirmationRequired)
  if (votingUserids.length > 0) {
    console.log(`Try update users:id:${banneduserid}`)
    await updateItem({
      TableName: BANNED_USERS_TABLE_NAME,
      Key: { id: banneduserid },
      UpdateExpression: `
      ADD #vu :u
      SET #cr = :v
      `,
      ExpressionAttributeNames: {
        '#vu': 'votingUsers',
        '#cr': 'confirmationRequired'
      },
      ExpressionAttributeValues: {
        ':u': new Set(votingUserids),
        // reset for the last request (to count for leaving user)
        // count for previous confirmations, if any (will be counted by the reply)
        ':v': Math.min(CONFIRMATION_REQUIRED, confirmedUsers.size + votingUserids.length)
      }
    },
    dynamoDBDocumentClient
    )
  } else {
    // This only happen if two consecutive request for the the same users
    // without any interactions or changes on any users
    // (all users are already either on the confirmed or in the voting sets)
    console.log('No voting users.')
  }

  // debug
  const lambdaResponse = {
    statusCode: 200,
    body: JSON.stringify('Ban request done!')
  }

  console.log(`Returns:\n${JSON.stringify(lambdaResponse)}`)
  return lambdaResponse
}
