import { readFileSync } from "fs";

export function isEmulator() {
  return Boolean(process.env.FUNCTIONS_EMULATOR);
}

export function isCypress() {
  try {
    readFileSync('./IS_CYPRESS', 'utf8');
  return true;
  } catch (e) {
  return false;
  }
}
