import firebase from 'firebase';

const ENV = 'production';
const config = {
  apiKey: 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM',
  authDomain: 'scotdance.firebaseapp.com',
  databaseURL: 'https://scotdance.firebaseio.com',
  projectId: 'firebase-scotdance',
  storageBucket: 'firebase-scotdance.appspot.com',
  messagingSenderId: '635645850119',
};
firebase.initializeApp(config);

const idKey = '.key';
const db = firebase.database().ref(ENV);

export {
  idKey,
  db,
  config,
  firebase,
};
