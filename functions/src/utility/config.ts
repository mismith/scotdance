import { defineSecret } from 'firebase-functions/params';

const runtimeConfigSecret = defineSecret('RUNTIME_CONFIG');
const geocodingApiKeySecret = defineSecret('GOOGLE_GEOCODING_API_KEY');
// Signs the passes ScotDance.app's own tools (Challenge) exchange for a sign-in of their own (toolPass.ts).
const toolPassSecretDef = defineSecret('TOOL_PASS_SECRET');

export { runtimeConfigSecret as runtimeConfig };
export { geocodingApiKeySecret as geocodingApiKey };
export { toolPassSecretDef as toolPassSecret };

export function getConfig() {
  return JSON.parse(runtimeConfigSecret.value());
}
