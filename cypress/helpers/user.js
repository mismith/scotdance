import seed from './seed';

export const USER_UID = {
  TEST: 'TEST',
  OTHER: 'OTHER',
  ADMIN: 'ADMIN',
};

export const USER_CREDENTIALS = {
  [USER_UID.TEST]: ['test@scotdance.app', 'WelcomeTest1'],
  [USER_UID.OTHER]: ['other@scotdance.app', 'WelcomeOther1'],
  [USER_UID.ADMIN]: ['admin@scotdance.app', 'WelcomeAdmin1'],
}

export function createUser(uid) {
  const [email, password] = USER_CREDENTIALS[uid];
  return seed.auth.createUser({
    uid,
    email,
    password,
  }, uid === USER_UID.ADMIN);
}
