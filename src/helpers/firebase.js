import * as firebase from 'firebase/app';
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
firebase.initializeApp(config);

const idKey = '.key';
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
        item['.value'] = value;
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
  config,
  firebase,
  idKey,
  db,
  buckets,
  toOrderedArray,
};
