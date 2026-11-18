// Makes the Ed25519 key pair ScotDance.app signs sign-in passes with.
//   node functions/scripts/new-pass-key.mjs | gcloud secrets create TOOL_PASS_PRIVATE_KEY --data-file=-
// stdout is the private key (PKCS8 PEM) and nothing else, so it can be piped straight into the secret.
// stderr is the public key (base64 SPKI DER, for PASS_PUBLIC_KEYS in passKeys.ts) and its kid.
import { createHash, generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const spki = publicKey.export({ format: 'der', type: 'spki' });

process.stdout.write(privateKey.export({ format: 'pem', type: 'pkcs8' }));
console.error(`public key: ${spki.toString('base64')}`);
console.error(`kid: ${createHash('sha256').update(spki).digest('base64url').slice(0, 16)}`);
