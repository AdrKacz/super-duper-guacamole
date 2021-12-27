require('dotenv').config();

const admin = require('firebase-admin');

const serviceAccount = require(process.env.SERVICE_ACCOUNT); // Never upload this file to the cloud

// Initialise Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function sendMessage() {
  // Fetch the tokens from an external datastore (e.g. database)
  const token = process.env.REGISTRATION_TOKEN;

  // Send a message to devices with the registered tokens
  await admin.messaging().send({
    token,
    data: { hello: 'Alice!' },
  }).then((response) => {
    // Response is a message ID string.
    console.log('Successfully sent message:', response);
  }).catch((error) => {
    console.log('Error sending message:', error);
  });
}

// Send messages to our users
sendMessage();
