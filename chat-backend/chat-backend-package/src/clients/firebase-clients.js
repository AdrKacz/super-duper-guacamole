// ===== ==== ====
// IMPORTS
const { initializeApp, cert } = require('firebase-admin/app') // skipcq: JS-0260
const { getMessaging } = require('firebase-admin/messaging') // skipcq: JS-0260

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
