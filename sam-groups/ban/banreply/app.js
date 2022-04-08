// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const { BANNED_USERS_TABLE_NAME, BAN_LAMBDA_ARN, AWS_REGION } = process.env

const ddb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION })
const lambda = new AWS.Lambda({ region: AWS_REGION })

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  const userid = body.userid

  // groupid
  // TODO: verify user is still in group (already verify is user is allowed to vote below)
  const groupid = body.groupid

  // banneduserid
  const banneduserid = body.banneduserid

  // groupid
  // const groupid = body.groupid

  // status (confirmed or denied)
  const status = body.status

  // TODO: verify userid and banneduserid are in group
  // get banned user
  const banneduser = await ddb.get({
    TableName: BANNED_USERS_TABLE_NAME,
    Key: { id: banneduserid },
    AttributesToGet: ['id', 'votingUsers', 'confirmedUsers', 'confirmationRequired']
  }).Item

  // verify banned user exists
  // (don't throw error, this situation can happen)
  // (for example, if you need 2 users to confirm but you send the request to 4)
  // (once the first 2 have confirm, you could still receive confirm answer)
  // (and thus even if the vote is closed)
  if (!banneduser) {
    console.log(`User ${banneduserid} is not in a ban vote. Returns`)
    return
  }

  const votingUsers = banneduser.votingUsers?.values ?? []
  const confirmedUsers = banneduser.confirmedUsers?.values ?? []
  const confirmationRequired = banneduser.confirmationRequired

  console.log(`votingUsers:\n${JSON.stringify(votingUsers)}`)
  console.log(`confirmedUsers:\n${JSON.stringify(confirmedUsers)}`)
  console.log(`confirmationRequired: ${confirmationRequired}`)

  if (votingUsers === undefined || confirmationRequired === undefined) {
    throw Error('votingUsers, and confirmationRequired are not all two defined')
  }

  // verify userid can still vote
  if (!votingUsers.includes(userid)) {
    console.log(`User ${userid} not in voting users:\n${JSON.stringify(votingUsers)}`)
    throw Error('action not allowed')
  }

  // number of users that can still confirm: votingUsers.length
  // number of users that have already confirmed: confirmedUsers.length

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

  let banstatus
  switch (status) {
    case 'confirmed':
      if (confirmedUsers.length + 1 >= confirmationRequired) {
        console.log(`User ${banneduserid} is banned by the group (positive vote ration ${confirmedUsers.length + 1} / ${votingUsers.length + confirmedUsers.length})`)
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
        console.log(`Not enough people remaining to ban ${banneduserid} (negative vote ration ${votingUsers.length - 1} / ${votingUsers.length + confirmedUsers.length})`)
        // close the ban
        banstatus = 'denied'
      }
      break
    default:
      console.log(`Status (${status}) has to be "confirmed" or "denied".`)
      throw Error('status not allowed')
  }

  // don't update database if denied
  // (or you could recreate the banneduser item you will delete with BAN_LAMBDA status='denied)
  if (banstatus === undefined || banstatus === 'confirmed') {
    console.log(`Try update bannedused ${banneduserid} - UPDATES:\n${JSON.stringify(params.AttributeUpdates)}`)
    await ddb.update(params).promise()
  }

  // BAN_LAMBDA will fire an error if status is not 'confirmed' or 'denied'
  if (banstatus !== undefined) {
    lambda.invoke({
      FunctionName: BAN_LAMBDA_ARN,
      InvocationType: 'Event',
      Paryload: JSON.stringify({
        banneduserid: banneduserid,
        status: banstatus,
        groupid: groupid,
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
      })
    })
  }

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify('Ban reply confirmed!')
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
