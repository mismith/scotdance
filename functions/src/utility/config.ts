import { defineSecret } from 'firebase-functions/params';

const runtimeConfigSecret = defineSecret('RUNTIME_CONFIG');

export { runtimeConfigSecret as runtimeConfig };

export function getConfig() {
  return JSON.parse(runtimeConfigSecret.value());
}
