import { reload, sendEmailVerification, type User } from 'firebase/auth'

/** Run only after the bridge has checked the parent origin and its audience. */
export async function verifyEmailForOwner(currentUser: () => User | null | undefined, uid: string) {
  const user = currentUser()
  if (!user || user.uid !== uid) throw new Error('Sign in to ScotDance with this account again, then retry Verify.')
  await reload(user)
  if (currentUser()?.uid !== uid) throw new Error('Your account changed. Sign in again.')
  if (!user.emailVerified) await sendEmailVerification(user)
}
