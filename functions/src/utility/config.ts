import { createPrivateKey, type KeyObject } from 'node:crypto';
import { defineSecret } from 'firebase-functions/params';
import { emulatorKey } from '../passKeys';
import { isEmulator } from './env';

const runtimeConfigSecret = defineSecret('RUNTIME_CONFIG');
const geocodingApiKeySecret = defineSecret('GOOGLE_GEOCODING_API_KEY');
// LEGACY(tool-pass-secret): the shared secret that used to sign passes and server messages; kept until every tool has switched.
const toolPassSecretDef = defineSecret('TOOL_PASS_SECRET');
// The Ed25519 private key (PKCS8 PEM) that signs the passes ScotDance.app's own tools exchange for a sign-in of their own (toolPass.ts).
const toolPassPrivateKeyDef = defineSecret('TOOL_PASS_PRIVATE_KEY');

export { runtimeConfigSecret as runtimeConfig };
export { geocodingApiKeySecret as geocodingApiKey };
export { toolPassSecretDef as toolPassSecret };
export { toolPassPrivateKeyDef as toolPassPrivateKey };

let passKey: KeyObject | undefined;
/** The key passes are signed with: the fixed emulator key on the emulators, else the secret. Built once. */
export function passSigningKey(): KeyObject {
  passKey ??= isEmulator() ? emulatorKey().privateKey : createPrivateKey(toolPassPrivateKeyDef.value());
  return passKey;
}

export function getConfig() {
  return JSON.parse(runtimeConfigSecret.value());
}
