import { createHash, createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';

// ScotDance.app signs sign-in passes with an Ed25519 private key that only its own project holds. Everything
// here is public: a tool can check a pass with these keys but can never make one.

/** ScotDance.app's pass keys, as base64 SPKI DER. Two entries only while a key is being replaced. */
export const PASS_PUBLIC_KEYS: readonly string[] = [];

const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * Emulators only. Derived from a fixed phrase, so every ScotDance repo's emulator agrees without a shared
 * secret. It is not secret, so nothing deployed may ever trust it: see `trustedKeys`.
 */
export function emulatorKey(): { privateKey: KeyObject; publicKey: KeyObject } {
  const seed = createHash('sha256').update('scotdance emulator pass key').digest();
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  return { privateKey, publicKey: createPublicKey(privateKey) };
}

/** A key's name in a pass header (`kid`): the start of its own hash, so it never needs configuring. */
export function keyId(key: KeyObject): string {
  const spki = (key.type === 'private' ? createPublicKey(key) : key).export({ format: 'der', type: 'spki' });
  return createHash('sha256').update(spki).digest('base64url').slice(0, 16);
}

/** The keys a pass may be signed with here. The emulator key is trusted on the emulators and nowhere else. */
export function trustedKeys(emulator: boolean): KeyObject[] {
  const keys = PASS_PUBLIC_KEYS.map((spki) =>
    createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' }),
  );
  return emulator ? [...keys, emulatorKey().publicKey] : keys;
}
