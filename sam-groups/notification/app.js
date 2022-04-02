const admin = require('firebase-admin')

const { FIREBASE_SERVICE_ACCOUNT_KEY } = process.env

const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const notification = {
  title: 'Les gens parlent 🎉',
  body: 'Tu es trop loin pour entendre ...'
}

exports.handler = async (event) => {
  console.log(`Receives:\n\tEvent:\n${JSON.stringify(event)}`)

  // groupid
  const groupid = event.groupid
  if (!groupid) {
    return {
      statusCode: 500,
      body: JSON.stringify('event.groupid is not defined')
    }
  }

  // error flag
  const error = false

  // topic
  const topic = `group-${groupid}`

  // send notification
  await admin.messaging().send({ notification, topic }).then(_ => {
    console.log('Successfully sent notification to:', topic)
  }).catch(error => {
    error = true
    console.log(`[error] send notification to ${topic}:`, error)
  })

  // returns
  if (error) {
    return {
      statusCode: 500,
      body: JSON.stringify('error sending notifications')
    }
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify('notifications sent without error')
    }
  }
}
