import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref as dbRef } from 'firebase/database'
import { getStorage, connectStorageEmulator, ref as storageRef } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

export const firebaseApp = initializeApp({
  apiKey: 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM',
  authDomain: 'scotdance.firebaseapp.com',
  databaseURL: 'https://scotdance.firebaseio.com',
  projectId: 'firebase-scotdance',
  storageBucket: 'firebase-scotdance.appspot.com',
  messagingSenderId: '635645850119',
  appId: '1:635645850119:web:96255e79df76024e0e70a2',
  measurementId: 'G-SFLYLX3P6L',
})

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export const auth = getAuth(firebaseApp)
export const database = getDatabase(firebaseApp)
export const storage = getStorage(firebaseApp)
export const functions = getFunctions(firebaseApp)

if (import.meta.env.MODE === 'emulator') {
  // Use the host the page was served from so LAN devices (phones via --host) hit
  // the dev machine, not themselves.
  const host = window.location.hostname
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectDatabaseEmulator(database, host, 9009)
  connectStorageEmulator(storage, host, 9199)
  connectFunctionsEmulator(functions, host, 5001)
}

export const dataRef = (path: string = '') =>
  dbRef(database, path ? `${NAMESPACE}/${path}` : NAMESPACE)

export const bucketRef = (path: string = '') =>
  storageRef(storage, path ? `${NAMESPACE}/${path}` : NAMESPACE)
