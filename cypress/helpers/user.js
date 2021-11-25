import seed from './seed';

export const USER_UID = {
  TEST: 'TEST',
  ADMIN: 'ADMIN',
};

export function createUser(uid) {
  return seed.auth.createUser({
    uid,
    email: uid === USER_UID.ADMIN ? 'admin@scotdance.app' : 'test@scotdance.app',
    password: uid === USER_UID.ADMIN ? 'WelcomeAdmin1' : 'WelcomeTest1',
  }, uid === USER_UID.ADMIN);
}
