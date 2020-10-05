import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import 'firebase/storage';
import 'firebase/messaging';
import { requestPermission } from './notifications';

// config
const FIREBASE_ENV = process.env.NODE_ENV || 'production';
const instance = FIREBASE_ENV === 'development' ? 'scotdance-dev' : 'scotdance';
const config = {
  apiKey: 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM',
  authDomain: 'scotdance.firebaseapp.com',
  databaseURL: `https://${instance}.firebaseio.com`,
  projectId: 'firebase-scotdance',
  storageBucket: 'firebase-scotdance.appspot.com',
  messagingSenderId: '635645850119',
};
const app = firebase.initializeApp(config);

// database
// https://stackoverflow.com/a/36087084/888928
const pushidRegex = /^[-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz]{20}$/;
const idKey = '.key';
const valueKey = '.value';
const db = firebase.database().ref(FIREBASE_ENV);

// storage
const buckets = firebase.storage().ref(FIREBASE_ENV);

// messaging
// const vapidKey = 'BGR0DKFnXHVfCFhPuTlxZcYH-k1vXqdPq0_LWtWUIelTJr6Zk2B809T4UfQ-20mM2rMxmHN0JisT99-iOBW6qAQ';
const notifications = {
  isSupported: true || firebase.messaging.isSupported(),
  requestPermission,
};
// notifications.onMessage((payload) => {
//   console.log(payload);
// });

// utility
const toOrderedArray = (obj) => {
  return Object.entries(obj || {})
    .map(([key, value]) => {
      const item = {
        [idKey]: key,
      };
      if (typeof item === 'object') {
        Object.assign(item, value);
      } else {
        item[valueKey] = value;
      }
      return item;
    })
    .sort((a, b) => {
      if (a && b) {
        if (Number.isInteger(a.order) && Number.isInteger(b.order)) {
          return a.order - b.order;
        }
        return (a[idKey] || '').localeCompare(b[idKey] || '');
      }
      return 0;
    });
};

export {
  FIREBASE_ENV,
  firebase,
  config,
  app,
  pushidRegex,
  idKey,
  valueKey,
  db,
  buckets,
  notifications,
  toOrderedArray,
};
