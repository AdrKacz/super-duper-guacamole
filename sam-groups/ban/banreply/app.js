// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const { sendToConnectionId, ban, sendToUsers } = require('helpers')

const { USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, AWS_REGION } = process.env

const ddb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION })

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
  const request = await ddb.get({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    AttributesToGet: ['id', 'votingUsers', 'confirmedUsers', 'confirmationRequired']
  }).promise()

  console.log(`Banned user ${banneduserid} request:\n${JSON.stringify(request)}`)

  // verify banned user exists
  // (don't throw error, this situation can happen)
  // (for example, if you need 2 users to confirm but you send the request to 4)
  // (once the first 2 have confirm, you could still receive confirm answer)
  // (and thus even if the vote is closed)
  if (!request.Item) {
    console.log(`User ${banneduserid} is not in a ban vote. Returns`)
    return {
      statusCode: 200,
      body: JSON.stringify('Ban reply denied!')
    }
  }

  const votingUsers = request.Item.votingUsers?.values ?? []
  const confirmedUsers = request.Item.confirmedUsers?.values ?? []
  const confirmationRequired = request.Item.confirmationRequired

  console.log(`votingUsers:\n${JSON.stringify(votingUsers)}`)
  console.log(`confirmedUsers:\n${JSON.stringify(confirmedUsers)}`)
  console.log(`confirmationRequired: ${confirmationRequired}`)

  if (votingUsers === undefined || confirmationRequired === undefined) {
    throw Error('votingUsers, and confirmationRequired are not all two defined')
  }

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

  // always remove userid from voting users
  const params = {
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    AttributeUpdates: {
      votingUsers: {
        Action: 'DELETE',
        Value: ddb.createSet([userid])
      }
    }
  }

  // number of users that can still confirm: votingUsers.length
  // number of users that have already confirmed: confirmedUsers.length
  // (not counting the current user)
  let banstatus
  switch (status) {
    case 'confirmed':
      if (confirmedUsers.length + 1 >= confirmationRequired) {
        console.log(`User ${banneduserid} is banned by the group (positive vote ratio ${confirmedUsers.length + 1} / ${votingUsers.length + confirmedUsers.length})`)
        // ban user
        banstatus = 'confirmed'
      }

      params.AttributeUpdates.confirmedUsers = {
        Action: 'ADD',
        Value: ddb.createSet([userid])
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

  console.log(`Try update bannedused ${banneduserid} - UPDATES:\n${JSON.stringify(params.AttributeUpdates)}`)
  await ddb.update(params).promise()

  if (banstatus !== undefined) {
    // vote is finished
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
      endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
    })

    // resolve the ban (depending on the status)
    const { users, banneduser, Data } = await ban(USERS_TABLE_NAME, GROUPS_TABLE_NAME, BANNED_USERS_TABLE_NAME, banneduserid, groupid, status, ddb)

    let usedUsers = users
    if (banstatus === 'denied') {
      // don't inform user he/she was in a ban vote
      usedUsers = users.filter((id) => id !== banneduserid)
    }

    await Promise.all(await sendToUsers(USERS_TABLE_NAME, usedUsers, apigwManagementApi, ddb, Data))

    if (banstatus === 'confirmed') {
      // inform banned user of his/her new group
      // NOTE: could create a custome signal switchgroupafterban
      // (to inform the user where it has been moved to)
      await sendToConnectionId(USERS_TABLE_NAME, banneduser.userid, banneduser.connectionId, apigwManagementApi, ddb, { action: 'switchgroup', groupid: banneduser.groupid })
    }
  }

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify('Ban reply confirmed!')
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
