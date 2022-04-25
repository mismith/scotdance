import moment from 'moment';

import seed from './seed';
import { USER_UID } from './user';

export const SUBMISSION_UID = {
  MISSING: 'MISSING',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  // REJECTED: 'REJECTED',
};

export function createSubmission(uid) {
  return seed.database.set(`development/competitions:submissions/${uid}`, {
    competition: {
      name: `Competition ${uid}`,
    },
    contact: {
      name: 'Testy Tester',
    },
    submitted: moment().format(),
    approved: uid === SUBMISSION_UID.APPROVED ? moment().format() : null,
    approvedBy: uid === SUBMISSION_UID.APPROVED ? USER_UID.OTHER : null,
    competitionId: uid === SUBMISSION_UID.APPROVED ? SUBMISSION_UID.APPROVED : null,
    // rejected: uid === SUBMISSION_UID.REJECTED ? moment().format() : null,
    // rejectedBy: uid === SUBMISSION_UID.APPROVED ? USER_UID.OTHER : null,
  });
}
