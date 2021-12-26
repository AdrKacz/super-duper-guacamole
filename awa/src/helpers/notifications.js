import notifee, {IOSAuthorizationStatus} from '@notifee/react-native';

export async function requestUserPermission() {
  const settings = await notifee.requestPermission();

  if (settings.authorizationStatus >= IOSAuthorizationStatus.AUTHORIZED) {
    console.log('Permission settings:', settings);
  } else {
    console.log('User declined permissions');
  }
}

export async function displayNotification() {
  // Ask for permission if not already done
  await requestUserPermission();
  console.log('--- Push Notification');
  // Create a channel
  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
  });

  // Display a notification
  await notifee.displayNotification({
    title: 'Notification Title',
    body: 'Main content body of the notification',
    android: {
      channelId,
    },
  });
  console.log('\n\n ==== DONE =====');
}
