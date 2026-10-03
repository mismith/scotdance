export function isEmulator() {
  return Boolean(process.env.FUNCTIONS_EMULATOR);
}
