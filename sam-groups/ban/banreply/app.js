// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk')

const { BANNED_USERS_TABLE_NAME, MINIMUM_NUMBER_OF_BAN_CONFIRMATION, AWS_REGION } = process.env

const ddb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION })

exports.handler = async (event) => {
  console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`)

  // body to object
  const body = JSON.parse(event.body)

  // userid
  const userid = body.userid

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
    AttributesToGet: ['id', 'votingUsers', 'confirmedUsers']
  }).Item

  // verify banned user exists
  if (!banneduser) {
    console.log(`User ${banneduserid} is not in a ban vote. Returns`)
    return
  }

  const votingUsers = banneduser.votingUsers?.values ?? []
  const confirmedUsers = banneduser.confirmedUsers?.values ?? []

  // verify userid can still vote
  if (!votingUsers.includes(userid)) {
    console.log(`User ${userid} not in voting users:\n${JSON.stringify(votingUsers)}`)
    throw Error('action not allowed')
  }

  const minimumNumberOfConfirmation = Math.min(votingUsers.length + confirmedUsers.length, MINIMUM_NUMBER_OF_BAN_CONFIRMATION)

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
  switch (status) {
    case 'confirmed':
      if (confirmedUsers.length + 1 >= minimumNumberOfConfirmation) {
        console.log(`User ${banneduserid} is banned by the group (positive vote ration ${confirmedUsers.length + 1} / ${votingUsers.length + confirmedUsers.length})`)
      }
      params.AttributeUpdates.confirmedUsers = {
        Action: 'ADD',
        Value: ddb.createSet([userid])
      }
      break
    case 'denied':
      // ALL FORMULA ARE WRONG (above too)
      if (votingUsers.length - 1 < minimumNumberOfConfirmation) {
        console.log(`Not enough people remainig to ban ${banneduserid} (negative vote ration ${votingUsers.length - 1} / ${votingUsers.length + confirmedUsers.length})`)
      }
      break
    default:
      console.log(`Status (${status}) has to be "confirmed" or "denied".`)
      throw Error('status not allowed')
  }

  console.log(`Try update bannedused ${banneduserid} - UPDATES:\n${JSON.stringify(params.AttributeUpdates)}`)
  await ddb.update(params).promise()

  // debug
  const response = {
    statusCode: 200,
    body: JSON.stringify('Ban confirmed!')
  }

  console.log(`Returns:\n${JSON.stringify(response)}`)
  return response
}
