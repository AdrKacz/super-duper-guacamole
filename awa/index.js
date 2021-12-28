/**
 * @format
 */

// ===== ===== ===== ===== =====
// ===== ===== ===== ===== =====
// Firebase setup
import messaging from '@react-native-firebase/messaging';
import {displayNotification} from './src/helpers/notifications';

import {saveToken} from './src/gun/tokens';

// Note that an async function or a function that returns a Promise
// is required for both subscribers.
async function onMessageReceived(message) {
  displayNotification({author: 'FCM', message: `Hello ${message.data.hello}`});
}

messaging().onMessage(onMessageReceived);
messaging().setBackgroundMessageHandler(onMessageReceived);

(async function onAppBootstrap() {
  // Register the device with FCM
  if (!messaging().isDeviceRegisteredForRemoteMessages) {
    await messaging().registerDeviceForRemoteMessages();
  }

  // Get the token
  const token = await messaging().getToken();

  // Save the token
  console.log(`Token\n${token}`);
  saveToken(token);
})();

// ===== ===== ===== ===== =====
// ===== ===== ===== ===== =====

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
