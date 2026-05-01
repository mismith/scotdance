import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref as dbRef } from 'firebase/database';
import { getStorage, connectStorageEmulator, ref as storageRef } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
});

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production';

export const auth = getAuth(firebaseApp);
export const database = getDatabase(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp);

if (import.meta.env.MODE === 'emulator') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectDatabaseEmulator(database, 'localhost', 9009);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export const dataRef = (path: string = '') =>
  dbRef(database, path ? `${NAMESPACE}/${path}` : NAMESPACE);

export const bucketRef = (path: string = '') =>
  storageRef(storage, path ? `${NAMESPACE}/${path}` : NAMESPACE);
