import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import 'firebase/storage';

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

// https://stackoverflow.com/a/36087084/888928
const pushidRegex = /^[-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz]{20}$/;
const idKey = '.key';
const valueKey = '.value';
const db = firebase.database().ref(FIREBASE_ENV);

const buckets = firebase.storage().ref(FIREBASE_ENV);

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
  toOrderedArray,
};
