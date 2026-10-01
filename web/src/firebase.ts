import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref as dbRef } from 'firebase/database'
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

export const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export const auth = getAuth(firebaseApp)
export const database = getDatabase(firebaseApp)
export const functions = getFunctions(firebaseApp)

/** Emulator port, shifted by VITE_EMULATOR_PORT_OFFSET so a second stack can run beside the first. */
export const emulatorPort = (port: number) =>
  port + (Number(import.meta.env.VITE_EMULATOR_PORT_OFFSET) || 0)

/** Emulator builds, and unit tests (Vitest's mode), never reach the real project. */
export const useEmulators = import.meta.env.MODE === 'emulator' || import.meta.env.MODE === 'test'

if (useEmulators) {
  // Use the host the page was served from so LAN devices (phones via --host) hit
  // the dev machine, not themselves.
  const host = window.location.hostname || 'localhost'
  connectAuthEmulator(auth, `http://${host}:${emulatorPort(9099)}`, { disableWarnings: true })
  connectDatabaseEmulator(database, host, emulatorPort(9009))
  connectFunctionsEmulator(functions, host, emulatorPort(5001))
}

export const dataRef = (path: string = '') =>
  dbRef(database, path ? `${NAMESPACE}/${path}` : NAMESPACE)
