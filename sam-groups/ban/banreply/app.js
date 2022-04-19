const {
  getDynamoDBDocumentClient,
  getApiGatewayManagementApiClient,
  getItem,
  updateItem,
  sendToUser,
  sendToUsers,
  ban
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
  const userid = body.userid

  // groupid
  // TODO: verify groupid is correct
  const groupid = body.groupid

  // banneduserid
  const banneduserid = body.banneduserid

  // groupid
  // const groupid = body.groupid

  // status (confirmed or denied)
  const status = body.status

  // TODO: verify userid and banneduserid are in group
  // get banned user
  console.log(`Try to GET ${BANNED_USERS_TABLE_NAME}:id:${banneduserid}`)
  const response = await getItem({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    ProjectionExpression: '#i, #vu, #cu, #cr',
    ExpressionAttributeNames: {
      '#i': 'id',
      '#vu': 'votingUsers',
      '#cu': 'confirmedUsers',
      '#cr': 'confirmationRequired'
    }
  },
  dynamoDBDocumentClient)

  console.log(`Banned user ${banneduserid} response:\n${JSON.stringify(response)}`)

  // verify banned user exists
  // (don't throw error, this situation can happen)
  // (for example, if you need 2 users to confirm but you send the request to 4)
  // (once the first 2 have confirm, you could still receive confirm answer)
  // (and thus even if the vote is closed)
  if (!response.Item) {
    console.log(`User ${banneduserid} is not in a ban vote. Returns`)
    return {
      statusCode: 200,
      body: JSON.stringify('Ban reply denied!')
    }
  }

  if (response.Item.votingUsers === undefined || response.Item.confirmationRequired === undefined) {
    throw Error('votingUsers, and confirmationRequired are not all two defined')
  }

  const votingUsers = Array.from(response.Item.votingUsers)
  const confirmedUsers = Array.from(response.Item.confirmedUsers ?? [])
  const confirmationRequired = response.Item.confirmationRequired

  console.log(`votingUsers:\n${JSON.stringify(votingUsers)}`)
  console.log(`confirmedUsers:\n${JSON.stringify(confirmedUsers)}`)
  console.log(`confirmationRequired: ${confirmationRequired}`)

  // verify userid can still vote
  // (don't throw error, this situation can happen)
  // (for example, if you receive a ban request but don't answer a quit the app)
  // (while you are not here someone else ask again to ban the same user)
  // (you are not part of the voting users this time because you weren't there)
  // (but when you reopen the app, you can still vote with the old dialog)
  // (your vote will simply not be taken into account, without error)
  if (!votingUsers.includes(userid)) {
    console.log(`User ${userid} not in voting users:\n${JSON.stringify(votingUsers)}. Returns`)
    return
  }

  // number of users that can still confirm: votingUsers.length
  // number of users that have already confirmed: confirmedUsers.length
  // (not counting the current user)
  let banstatus
  switch (status) {
    case 'confirmed':
      if (confirmedUsers.length + 1 >= confirmationRequired) {
        console.log(`User ${banneduserid} is banned by the group (positive vote ratio ${confirmedUsers.length + 1} / ${votingUsers.length + confirmedUsers.sizlengthe})`)
        // ban user
        banstatus = 'confirmed'
      }

      break
    case 'denied':
      if (confirmedUsers.length + votingUsers.length - 1 < confirmationRequired) {
        // not enought voting users left
        console.log(`Not enough people remaining to ban ${banneduserid} (negative vote ratio ${votingUsers.length - 1} / ${votingUsers.length + confirmedUsers.length})`)
        // close the ban
        banstatus = 'denied'
      }
      break
    default:
      console.log(`Status (${status}) has to be "confirmed" or "denied".`)
      throw Error('status not allowed')
  }

  const commandInput = {
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    UpdateExpression: `
    DELETE #vu :u
    ADD #cu :u
    `,
    ExpressionAttributeNames: {
      '#vu': 'votingUsers',
      '#cu': 'confirmedUsers'
    },
    ExpressionAttributeValues: {
      ':u': new Set([userid])
    }
  }
  console.log(`Try update bannedused ${banneduserid} - Command input:\n${JSON.stringify(commandInput)}`)
  await updateItem(
    commandInput,
    dynamoDBDocumentClient
  )

  if (banstatus !== undefined) {
    // vote is finished
    const apiGatewayManagementApiClient = getApiGatewayManagementApiClient(
      AWS_REGION,
      {
        protocol: 'https',
        hostname: event.requestContext.domainName,
        path: event.requestContext.stage
      }
    )

    // resolve the ban (depending on the status)
    const { users, banneduser, Data } = await ban(USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, banneduserid, groupid, status, dynamoDBDocumentClient)

    let usedUsers = users
    if (banstatus === 'denied') {
      // don't inform user he/she was in a ban vote
      usedUsers = users.filter((id) => id !== banneduserid)
    }

    await Promise.all(await sendToUsers(USERS_TABLE_NAME, usedUsers, apiGatewayManagementApiClient, dynamoDBDocumentClient, Data))

    if (banstatus === 'confirmed') {
      // inform banned user of his/her new group
      // NOTE: could create a custome signal switchgroupafterban
      // (to inform the user where it has been moved to)
      await sendToUser(USERS_TABLE_NAME, banneduser.userid, banneduser.connectionId, apiGatewayManagementApiClient, dynamoDBDocumentClient, { action: 'switchgroup', groupid: banneduser.groupid })
    }
  }

  // debug
  const lambdaResponse = {
    statusCode: 200,
    body: JSON.stringify('Ban reply confirmed!')
  }

  console.log(`Returns:\n${JSON.stringify(lambdaResponse)}`)
  return lambdaResponse
}
