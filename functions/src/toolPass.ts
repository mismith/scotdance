import { createHmac, randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';

// "Sign in with ScotDance.app" for ScotDance.app's own tools on other
// Firebase projects (Challenge first; ADR 0015). The connect page, signed in
// here, asks for a pass for one tool; the tool's own function checks it with
// the same secret and signs the person in there. Short-lived and for that tool
// alone: never this project's own sign-in, so a tool can't act as you here.
//
// A compact JWT, HS256: { iss, aud, sub (uid), email, name, iat, exp, jti }.

export const AUDIENCES = ['challenge'] as const;
export type Audience = (typeof AUDIENCES)[number];
export const ISSUER = 'https://scotdance.app';
export const PASS_SECONDS = 120;

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function signPass(
  secret: string,
  who: { uid: string; email?: string | null; name?: string | null; audience: Audience },
  now = Date.now(),
): string {
  const iat = Math.floor(now / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: ISSUER,
    aud: who.audience,
    sub: who.uid,
    email: who.email ?? null,
    name: who.name ?? null,
    iat,
    exp: iat + PASS_SECONDS,
    jti: randomUUID(),
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function isAudience(value: unknown): value is Audience {
  return typeof value === 'string' && (AUDIENCES as readonly string[]).includes(value);
}

interface Context {
  auth: { uid: string; token: { email?: string; name?: string; firebase?: { sign_in_provider?: string } } } | null;
}

/** toolPass({ audience }): a pass for that tool, for whoever is signed in. */
export function getOnToolPass(secret: () => string) {
  return async (data: { audience?: unknown } | undefined, ctx: Context) => {
    const auth = ctx.auth;
    if (!auth?.uid || auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'Sign in to ScotDance.app first.');
    }
    if (!isAudience(data?.audience)) throw new HttpsError('invalid-argument', 'Unknown tool.');
    return {
      pass: signPass(secret(), {
        uid: auth.uid,
        email: auth.token.email ?? null,
        name: auth.token.name ?? null,
        audience: data.audience,
      }),
    };
  };
}
