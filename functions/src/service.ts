import { sign, verify } from 'node:crypto';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { emulatorKey } from './passKeys';

// Which ScotDance server is calling. One server proves itself to another with the identity token Google issues
// to its service account: no shared secret, nothing to leak or rotate. The token rides in the request body as
// `service` (a callable's Authorization header is reserved for a person's Firebase sign-in), and the rest of
// the body is believed because of who sent it. This file is the same in every ScotDance repo.

/** The service accounts ScotDance servers run as. */
export const SERVICES = {
  hub: 'firebase-scotdance@appspot.gserviceaccount.com',
  entries: 'entries-runtime@scotdance-entries.iam.gserviceaccount.com',
  /** Entries development, and anything else in that project left on the default account: read-only at most. */
  entriesDevelopment: '679063538421-compute@developer.gserviceaccount.com',
} as const;

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
let auth: GoogleAuth | undefined;
const google = new OAuth2Client();

/**
 * This server's proof for one receiver. `audience` is the receiver's production URL, even when the call goes
 * to an emulator, so a token for one endpoint is refused by every other. `self` names this server for the
 * emulators, which have no Google identity to ask for.
 */
export async function serviceToken(audience: string, self: string, emulator: boolean): Promise<string> {
  if (emulator) {
    const now = Math.floor(Date.now() / 1000);
    const body = `${encode({ alg: 'EdDSA', typ: 'JWT' })}.${encode({ aud: audience, email: self, iat: now, exp: now + 300 })}`;
    return `${body}.${sign(null, Buffer.from(body), emulatorKey().privateKey).toString('base64url')}`;
  }
  auth ??= new GoogleAuth();
  return (await auth.getIdTokenClient(audience)).idTokenProvider.fetchIdToken(audience);
}

/** The calling server's account, once Google (or, on the emulators, the emulator key) vouches for it. Throws otherwise. */
export async function verifyService(
  token: unknown,
  audience: string,
  trusted: readonly string[],
  emulator: boolean,
): Promise<string> {
  if (typeof token !== 'string' || token.length > 10_000) throw new Error('Service proof required');
  let email: unknown;
  if (emulator) {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) throw new Error('Malformed service proof');
    if (
      !verify(
        null,
        Buffer.from(`${header}.${payload}`),
        emulatorKey().publicKey,
        Buffer.from(signature, 'base64url'),
      )
    )
      throw new Error('Bad service proof');
    const claims = decode(payload);
    if (claims.aud !== audience || !(claims.exp > Date.now() / 1000))
      throw new Error('Service proof is for elsewhere');
    email = claims.email;
  } else {
    const claims = (await google.verifyIdToken({ idToken: token, audience })).getPayload();
    if (claims?.email_verified !== true) throw new Error('Unknown service');
    email = claims.email;
  }
  if (typeof email !== 'string' || !trusted.includes(email)) throw new Error('Unknown service');
  return email;
}
