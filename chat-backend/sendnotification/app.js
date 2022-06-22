// DEPENDENCIES
// firebase-admin

// TRIGGER
// SNS

// ===== ==== ====
// EVENT
// Send push notification
// event.Records[0].Sns.Message
// WARNING - topic and user cannot be both undefined
// topic : String? - topic to send notification
// users : List<Object>? - list of users to send notification
//      firebaseToken : String - token to send notifications to
// notification: Map<Object>
//      title : String - Title of the notification
//      body : String -  Body of the notification

// ===== ==== ====
// IMPORTS
const { initializeApp, cert } = require('firebase-admin/app') // skipcq: JS-0260
const { getMessaging } = require('firebase-admin/messaging') // skipcq: JS-0260

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
`)

  const body = JSON.parse(event.Records[0].Sns.Message)

  const topic = body.topic
  const users = body.users
  if (topic === undefined && users === undefined) {
    throw new Error('topic and users cannot be both undefined')
  }

  const notification = body.notification
  if (notification === undefined || notification.title === undefined || notification.body === undefined) {
    throw new Error('notification.title notification.body must both be defined')
  }

  const promises = []
  if (topic !== undefined) {
    const message = { notification, topic }
    console.log(`Send:\n${JSON.stringify(message)}`)

    promises.push(messaging.send(message))
  }

  if (users !== undefined && users.length > 0) {
    const tokens = []
    for (const user of users) {
      if (user.firebaseToken !== undefined) {
        tokens.push(user.firebaseToken)
      }
    }
    if (tokens.length > 0) {
      const message = { notification, tokens }
      console.log(`Send:\n${JSON.stringify(message)}`)

      promises.push(messaging.sendMulticast(message))
    }
  }

  await Promise.allSettled(promises)
}
