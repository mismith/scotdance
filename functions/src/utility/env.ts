export function isEmulator() {
  return Boolean(process.env.FUNCTIONS_EMULATOR);
}
export function isCypress() {
  return Boolean(process.env.FIREBASE_CYPRESS);
}
