/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// import AsyncStorage from '@react-native-async-storage/async-storage';

import Amplify from 'aws-amplify';
import PushNotification from '@aws-amplify/pushnotification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import config from './src/aws-exports';

import { API, graphqlOperation } from 'aws-amplify';
import { createUser } from './src/graphql/mutations';

Amplify.configure(config);

AppRegistry.registerComponent(appName, () => App);

// Notifcation Handling

// get the notification data when notification is received
PushNotification.onNotification((notification) => {
  // Note that the notification object structure is different from Android and IOS
  console.log('in app notification', notification);

  // required on iOS only (see fetchCompletionHandler docs: https://github.com/react-native-community/push-notification-ios#finish)
  notification.finish(PushNotificationIOS.FetchResult.NoData);
});

// get the registration token
// This will only be triggered when the token is generated or updated.
PushNotification.onRegister((token) => {
  console.log('in app registration', token);
  // Token registration
  // TODO: Link this logically to user
  (async (_) => {
    try {
      const user = {
        token: token
      };
      await API.graphql(graphqlOperation(createUser, {input: user}))
    } catch (err) {
      console.warn('error creating user:', err)
    }
  })();
});

// get the notification data when notification is opened
PushNotification.onNotificationOpened((notification) => {
    console.log('the notification is opened', notification);
});
