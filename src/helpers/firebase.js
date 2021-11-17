import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import 'firebase/storage';

export function isLocalhost() {
  return window.location.hostname === 'localhost';
}

export { firebase };
const FIREBASE_ENV = process.env.NODE_ENV || 'production';
const config = {
  apiKey: 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM',
  authDomain: 'scotdance.firebaseapp.com',
  databaseURL: 'https://scotdance.firebaseio.com',
  projectId: 'firebase-scotdance',
  storageBucket: 'firebase-scotdance.appspot.com',
  messagingSenderId: '635645850119',
};
export const app = firebase.initializeApp(config);

if (isLocalhost()) {
  // port values from /firebase.json
  firebase.auth().useEmulator(`http://localhost:${9099}/`, { disableWarnings: true });
  firebase.database().useEmulator('localhost', 9000);
  firebase.storage().useEmulator('localhost', 9199);
  // firebase.functions().useEmulator("localhost", 5001);
}

// https://stackoverflow.com/a/36087084/888928
export const pushidRegex = /^[-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz]{20}$/;
export const idKey = '.key';
export const valueKey = '.value';
export const db = firebase.database().ref(FIREBASE_ENV);

export const buckets = firebase.storage().ref(FIREBASE_ENV);

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
