const { initializeApp, cert } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')

const App = {}

exports.sendNotification = (FIREBASE_SERVICE_ACCOUNT_KEY, notification, topic) => {
  if (App.app === undefined) {
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)
    App.app = initializeApp({
      credential: cert(serviceAccount)
    })
    App.messaging = getMessaging(App.app)
  }

  App.messaging.send({ notification, topic })
}
