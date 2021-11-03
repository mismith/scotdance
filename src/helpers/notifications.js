import { PushNotifications } from '@capacitor/push-notifications';

// eslint-disable-next-line import/prefer-default-export
export async function requestPermission() {
  const { granted } = await PushNotifications.requestPermission();
  if (granted) {
    PushNotifications.register();
  } else {
    console.warn('Permission not granted');
  }
}

/* eslint-disable */

// On success, we should be able to receive notifications
PushNotifications.addListener(
  'registration',
  (token) => {
    alert('Push registration success, token: ' + token.value);
  },
);

// Some issue with our setup and push will not work
PushNotifications.addListener(
  'registrationError',
  (error) => {
    alert('Error on registration: ' + JSON.stringify(error));
  },
);

// Show us the notification payload if the app is open on our device
PushNotifications.addListener(
  'pushNotificationReceived',
  (notification) => {
    alert('Push received: ' + JSON.stringify(notification));
  },
);

// Method called when tapping on a notification
PushNotifications.addListener(
  'pushNotificationActionPerformed',
  (notification) => {
    alert('Push action performed: ' + JSON.stringify(notification));
  },
);

/* eslint-enable */

//   async getToken() {
//     const plugin = await this.plugin;
//     if (plugin) {
//       return plugin.getToken();
//     }
//     if (this.messaging) {
//       return this.messaging.getToken();
//     }
//     return null;
//   }

//   async onTokenRefresh(handler) {
//     const plugin = await this.plugin;
//     if (plugin) {
//       return plugin.onTokenRefresh(handler);
//     }
//     if (this.messaging) {
//       return this.messaging.onTokenRefresh(handler);
//     }
//     return null;
//   }

//   async onMessage(handler) {
//     const plugin = await this.plugin;
//     if (plugin) {
//       return plugin.onNotificationOpen(handler);
//     }
//     if (this.messaging) {
//       return this.messaging.onMessage(handler);
//     }
//     return null;
//   }
// }
