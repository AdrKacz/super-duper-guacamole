require('dotenv').config();

const admin = require('firebase-admin');

const JSONServiceAccount = JSON.parse(process.env.JSON_ADMIN_SDK);

// Initialise Firebase
admin.initializeApp({
  credential: admin.credential.cert(JSONServiceAccount),
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
};
