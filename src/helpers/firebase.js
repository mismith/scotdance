import firebase from 'firebase/compat/app';
import 'firebase/compat/analytics';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import 'firebase/compat/functions';
import orderBy from 'lodash.orderby';

import { isCypress, isDev } from './env';

export { firebase };
const config = {
  apiKey: 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM',
  authDomain: 'scotdance.firebaseapp.com',
  databaseURL: isCypress() ? 'https://scotdance-cypress.firebaseio.com' : 'https://scotdance.firebaseio.com',
  projectId: 'firebase-scotdance',
  storageBucket: 'firebase-scotdance.appspot.com',
  messagingSenderId: '635645850119',
  appId: '1:635645850119:web:96255e79df76024e0e70a2',
  measurementId: 'G-SFLYLX3P6L',
};
export const app = firebase.initializeApp(config);
export const analytics = !isCypress() && firebase.analytics(app);

const FIREBASE_ENV = isDev() ? 'development' : 'production';
if (isDev()) {
  // port values from /firebase.json
  firebase.auth().useEmulator(`http://localhost:${9099}/`, { disableWarnings: true });
  firebase.database().useEmulator('localhost', 9009);
  firebase.storage().useEmulator('localhost', 9199);
  firebase.functions().useEmulator('localhost', 5001);
}

// https://stackoverflow.com/a/36087084/888928
export const pushidRegex = /^[-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz]{20}$/;
export const idKey = '.key';
export const valueKey = '.value';
export const userDragOrderKey = '_order';
export const db = firebase.database().ref(FIREBASE_ENV);

export const buckets = firebase.storage().ref(FIREBASE_ENV);

export const fns = firebase.functions();

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
        const aId = a[idKey] || '';
        const bId = b[idKey] || '';
        if (aId < bId) return -1;
        if (aId > bId) return 1;
      }
      return 0;
    });
};

export function sortByUserDragOrder(array) {
  return orderBy(
    array
      .map((item, i, arr) => ({
        _order: arr.length,
        ...item,
      })),
    [userDragOrderKey, idKey],
  );
}

export const cache = {
  competitions: {},
  categories: {},
  groups: {},
  reset() {
    this.competitions = {};
    this.categories = {};
    this.groups = {};
  },
};
