const admin = require('firebase-admin')

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const notification = {
  title: 'Nouveau message',
  body: "La conversation s'active"
}

exports.handler = async (event) => {
  // Log event
  console.log('Received event:\n', event)
  const roomId = event.room_id
  if (!roomId) {
    const response = {
      statusCode: 500,
      body: JSON.stringify('Room ID is not defined <event.room_id>')
    }
    return response
  }

  // Error Flag
  let hasError = false
  // Retreive topic
  const topic = `room-${roomId}`
  // Send message
  await admin
    .messaging()
    .send({ notification, topic: topic })
    .then(response => {
      console.log('Successfully send notification to:', topic)
    })
    .catch(error => {
      hasError = true
      console.log(`ERROR sending notification to ${topic}:\n`, error)
    })

  // Return
  if (hasError) {
    const response = {
      statusCode: 500,
      body: JSON.stringify('Error while sending notifications')
    }
    return response
  } else {
    const response = {
      statusCode: 200,
      body: JSON.stringify('Notifications sent without error')
    }
    return response
  }
}
