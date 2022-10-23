// ===== ==== ====
// IMPORTS
const { initializeApp, cert } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')

const { FIREBASE_SERVICE_ACCOUNT_KEY } = process.env

// ===== ==== ====
// CONSTANTS
const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)
const app = initializeApp({
  credential: cert(serviceAccount)
})

// ===== ==== ====
// EXPORTS
exports.messaging = getMessaging(app)