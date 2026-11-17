import { HttpsError } from 'firebase-functions/v2/https';
import type { Auth } from 'firebase-admin/auth';
import type { Reference } from 'firebase-admin/database';
import { getPostmark } from './utility/email';
import { sendOptions } from './utility/emailModel';

export function verificationLink(firebaseLink: string) {
  const original = new URL(firebaseLink);
  const code = original.searchParams.get('oobCode');
  if (!code || original.searchParams.get('mode') !== 'verifyEmail') throw new Error('Invalid verification link');
  const link = new URL('https://connect.scotdance.app/verify-email');
  link.searchParams.set('oobCode', code);
  return link.href;
}

export function getOnSendVerificationEmail(auth: Auth, limits: Reference) {
  return async (_data: unknown, context: { auth?: { uid: string } | null }) => {
    if (!context.auth) throw new HttpsError('unauthenticated', 'Sign in to verify your email.');
    const user = await auth.getUser(context.auth.uid);
    if (user.disabled || !user.email) throw new HttpsError('failed-precondition', 'This account cannot receive verification email.');
    if (user.emailVerified) return { verified: true };
    // One timestamp per account; no queue, trigger or retry worker.
    const now = Date.now();
    const reservation = await limits.child(user.uid).transaction(previous =>
      typeof previous === 'number' && now - previous < 60000 ? undefined : now);
    if (!reservation.committed) throw new HttpsError('resource-exhausted', 'Please wait a minute before resending.');
    try {
      const link = verificationLink(await auth.generateEmailVerificationLink(user.email));
      await getPostmark().sendEmailWithTemplate({
        ...sendOptions('verify-email'), From: 'ScotDance.app <admin@scotdance.app>', To: user.email,
        TemplateModel: {
          app: { name: 'ScotDance.app', url: 'https://next.scotdance.app', preview: null },
          account: { name: user.displayName?.trim().split(/\s+/)[0] || null, email: user.email },
          verification: { link },
        },
      });
      return { sent: true };
    } catch {
      throw new HttpsError('unavailable', 'Could not send the verification email. Please try again in a minute.');
    }
  };
}
