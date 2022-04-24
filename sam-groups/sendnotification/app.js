// DEPENDENCIES
// firebase-admin

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Send push notification
// event.Records[0].Sns.Message
// topic : String - Name of the topic
// notification: Map<String,String>
//      title - Title of the notification
//      body -  Body of the notification

// ===== ==== ====
// IMPORTS
const { initializeApp, cert } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')

// ===== ==== ====
// CONSTANTS
const {
  FIREBASE_SERVICE_ACCOUNT_KEY
} = process.env

// initialiaze app
const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)
const app = initializeApp({
  credential: cert(serviceAccount)
})
const messaging = getMessaging(app)

// ===== ==== ====
// HELPERS

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log(`
Receives:
\tRecords[0].Sns.Message:
${event.Records[0].Sns.Message}
\tRecords:
${JSON.stringify(event.Records)}
\tEnvironment:\n${JSON.stringify(process.env)}
`)

  const body = JSON.parse(event.Records[0].Sns.Message)

  const topic = body.topic
  if (topic === undefined) {
    throw new Error('topic must be defined')
  }

  const notification = body.notification
  if (notification === undefined || notification.title === undefined || notification.body === undefined) {
    throw new Error('notification.title event.body.notification.body and  must be defined')
  }

  console.log(`Send:
${JSON.stringify({ notification, topic })}`)

  await messaging.send({ notification, topic })
    .then((response) => {
    // Response is a message ID string.
      console.log('Successfully sent message:', response)
    })
    .catch((error) => {
      console.log('Error sending message:', error)
    })
}
