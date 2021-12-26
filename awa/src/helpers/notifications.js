import notifee, {IOSAuthorizationStatus} from '@notifee/react-native';

export async function requestUserPermission() {
  const settings = await notifee.requestPermission();

  if (settings.authorizationStatus >= IOSAuthorizationStatus.AUTHORIZED) {
    if (false) {
      console.log('Permission settings:', settings);
    }
  } else {
    console.warn('User declined permissions');
  }
}

export async function displayNotification({author, message}) {
  // Ask for permission if not already done
  await requestUserPermission();
  // Create a channel
  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
  });

  // Display a notification
  await notifee.displayNotification({
    title: author ?? 'Unknown',
    body: message ?? '...',
    android: {
      channelId,
    },
  });
}
