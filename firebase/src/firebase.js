require('dotenv').config();

const admin = require('firebase-admin');

const serviceAccount = require(process.env.SERVICE_ACCOUNT); // Never upload this file to the cloud

// Initialise Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.sendMessageDebug = async (token) => {
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
};

exports.sendMessages = async (tokens) => {
  // Send a message to devices with the registered tokens
  console.log('Send messages to:', tokens);
  await admin.messaging().sendMulticast({
    tokens,
    data: { hello: 'Alice!' },
  }).then((response) => {
    // Response is a message ID string.
    console.log('Successfully sent messages:', response);
  }).catch((error) => {
    console.log('Error sending messages:', error);
  });
}