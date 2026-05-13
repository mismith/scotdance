import { defineSecret } from 'firebase-functions/params';

const runtimeConfigSecret = defineSecret('RUNTIME_CONFIG');
const geocodingApiKeySecret = defineSecret('GOOGLE_GEOCODING_API_KEY');

export { runtimeConfigSecret as runtimeConfig };
export { geocodingApiKeySecret as geocodingApiKey };

export function getConfig() {
  return JSON.parse(runtimeConfigSecret.value());
}
