import firebase from 'firebase/compat/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import 'firebase/compat/database';
import { connectStorageEmulator, getStorage, ref as getStorageRef } from 'firebase/storage';

import { isCypress, isDev } from './env';

const config = {
  apiKey: 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM',
  authDomain: 'scotdance.firebaseapp.com',
  databaseURL: isCypress() ? 'https://scotdance-cypress.firebaseio.com' : 'https://scotdance.firebaseio.com',
  projectId: 'firebase-scotdance',
  storageBucket: 'firebase-scotdance.appspot.com',
  messagingSenderId: '635645850119',
};
export const app = firebase.initializeApp(config);

const FIREBASE_ENV = isDev() ? 'development' : 'production';
if (isDev()) {
  // port values from /firebase.json
  connectAuthEmulator(getAuth(), `http://localhost:${9099}/`, { disableWarnings: true });
  firebase.database().useEmulator('localhost', 9000);
  connectStorageEmulator(getStorage(), 'localhost', 9199);
  // firebase.functions().useEmulator("localhost", 5001);
}

// https://stackoverflow.com/a/36087084/888928
export const pushidRegex = /^[-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz]{20}$/;
export const idKey = '.key';
export const valueKey = '.value';
export const db = firebase.database().ref(FIREBASE_ENV);

export const buckets = getStorageRef(getStorage(), FIREBASE_ENV);
export { getStorageRef };

export const toOrderedArray = (obj) => {
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
