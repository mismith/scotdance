import { HttpsError } from 'firebase-functions/v2/https';
import { FirebaseInvites } from '@mismith/firebase-tools/dist/server';
import { getPostmark } from './utility/email';
import { V4_SITE, appModel, firstName, organisationMark, sendOptions, sentFrom } from './utility/emailModel';
import { isEmulator } from './utility/env';

// Organisations: the associations, games societies and series that run
// competitions or bring them together. Each is one record at
// /organisations/{id} (public), with its admins kept the way a competition
// keeps its own: users:permissions/{uid}/organisations/{id} and
// organisations:permissions/{id}/users/{uid}. A competition lists its
// organisations at /competitions/{id}/organisations/{organisationId} = true.

export async function attachUserToOrganisation({
  db,
  userId,
  organisationId,
  value = true,
}: {
  db: any
  userId: string
  organisationId: string
  value?: true | null
}) {
  if (!(db && userId && organisationId)) throw new Error('missing required props');
  return db.update({
    [`users:permissions/${userId}/organisations/${organisationId}`]: value,
    [`organisations:permissions/${organisationId}/users/${userId}`]: value,
  });
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface NewOrganisation {
  name?: string
  shortName?: string
  location?: string
  website?: string
}

/** Makes an organisation. Whoever it's made for becomes its admin. */
export async function createOrganisation(db: any, { name, shortName, location, website }: NewOrganisation, createdBy: string, adminId: string | null = createdBy, competitionId?: string) {
  const record = {
    name: text(name, 120),
    shortName: text(shortName, 24) || null,
    location: text(location, 120) || null,
    website: text(website, 300) || null,
    created: new Date().toISOString(),
    createdBy,
  };
  if (!record.name) throw new HttpsError('invalid-argument', 'An organisation needs a name.');
  const ref = db.child('organisations').push();
  const updates: Record<string, unknown> = { [`organisations/${ref.key}`]: record };
  if (adminId) {
    updates[`users:permissions/${adminId}/organisations/${ref.key}`] = true;
    updates[`organisations:permissions/${ref.key}/users/${adminId}`] = true;
  }
  if (competitionId) updates[`competitions/${competitionId}/organisations/${ref.key}`] = true;
  await db.update(updates);
  return ref.key as string;
}

/**
 * Callable. Anyone who manages a competition or an organisation can start
 * one (others submit a competition first), and add it to a competition they
 * manage. A system admin can make one without becoming its admin (`join:
 * false`), as when tagging old competitions.
 */
export function getOnCreate(db: any) {
  return async (data: any, ctx: any) => {
    const uid = ctx.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '');
    const perms = (await db.child(`users:permissions/${uid}`).get()).val() || {};
    const isAdmin = perms.admin === true;
    const some = (o: unknown) => Object.values((o || {}) as Record<string, unknown>).some((v) => v === true);
    if (!isAdmin && !some(perms.competitions) && !some(perms.organisations)) {
      throw new HttpsError('permission-denied', 'Submit a competition first.');
    }
    const key = (v: unknown): v is string => typeof v === 'string' && !!v && !['.', '#', '$', '[', ']', '/'].some((c) => v.includes(c));
    const competitionId = data?.competitionId;
    if (competitionId !== undefined && !key(competitionId)) throw new HttpsError('invalid-argument', 'Invalid competition.');
    let competition: any = null;
    if (competitionId) {
      if (!isAdmin && perms.competitions?.[competitionId] !== true) throw new HttpsError('permission-denied', 'You cannot manage this competition.');
      competition = (await db.child(`competitions/${competitionId}`).get()).val();
      if (!competition?.date) throw new HttpsError('not-found', 'This competition no longer exists.');
      if ((await db.child(`competitionLinks:sync/${competitionId}/organisations`).get()).val() === true) throw new HttpsError('failed-precondition', 'Add the organisation to the main competition.');
    }
    let adminId = isAdmin && data?.join === false ? null : uid;
    if (data?.grantSubmitter === true) {
      if (!isAdmin) throw new HttpsError('permission-denied', 'Only system admins can grant this access.');
      if (!key(competition?.submissionId)) throw new HttpsError('failed-precondition', 'The original submission is unavailable.');
      const sub = (await db.child(`competitions:submissions/${competition.submissionId}`).get()).val();
      if (sub?.competitionId !== competitionId || !key(sub?.submittedBy) || sub.submittedBy === 'admin') {
        throw new HttpsError('failed-precondition', 'The original submitter could not be verified.');
      }
      if (!(await db.child(`users/${sub.submittedBy}`).get()).exists()) throw new HttpsError('failed-precondition', 'The submitter’s account no longer exists.');
      adminId = sub.submittedBy;
    }
    // Re-check the current directory: another admin may have created the
    // suggestion while this form was open. Never grant access to that record.
    const normalise = (v: unknown) => text(v, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const names = [normalise(data?.name), normalise(data?.shortName)].filter(Boolean);
    const organisations = (await db.child('organisations').get()).val() || {};
    if (Object.values(organisations).some((o: any) => [normalise(o.name), normalise(o.shortName)].some((n) => n && names.includes(n)))) {
      throw new HttpsError('already-exists', 'This organisation already exists. Add it from the organisation picker.');
    }
    const organisationId = await createOrganisation(db, data ?? {}, uid, adminId, competitionId);
    return { organisationId };
  };
}

/**
 * The organisations an approved submission asked for: those it picked, if
 * they still exist, and new ones, made now with the submitter as their
 * admin. Picked ones you chose to make them an admin of as you approved it
 * (`adminOf`) do the same. Returns their ids, to list the new competition under.
 */
export async function organisationsForSubmission(db: any, submission: any): Promise<string[]> {
  const picked = Object.keys(submission?.organisations || {});
  const exists = await Promise.all(picked.map(async (id) => (await db.child(`organisations/${id}/name`).get()).exists()));
  const ids = picked.filter((_, i) => exists[i]);
  const submittedBy = submission?.submittedBy;
  if (submittedBy && submittedBy !== 'admin') {
    for (const id of ids.filter((id) => submission?.adminOf?.[id] === true)) {
      await attachUserToOrganisation({ db, userId: submittedBy, organisationId: id });
    }
  }
  for (const o of Object.values((submission?.newOrganisations || {}) as Record<string, NewOrganisation>)) {
    if (!text(o?.name, 120)) continue;
    ids.push(await createOrganisation(db, o, submission.approvedBy || 'admin', submission.submittedBy || null));
  }
  return ids;
}

/** A deleted organisation leaves nothing behind: its admins' access, its private data and its place on competitions. */
export function getOnDelete(db: any) {
  return async (_snap: any, ctx: any) => {
    const { organisationId } = ctx.params;
    const users = Object.keys((await db.child(`organisations:permissions/${organisationId}/users`).get()).val() || {});
    const competitions = (await db.child('competitions').get()).val() || {};
    const updates: Record<string, null> = {
      [`organisations:permissions/${organisationId}`]: null,
      [`organisations:data/${organisationId}`]: null,
    };
    for (const uid of users) updates[`users:permissions/${uid}/organisations/${organisationId}`] = null;
    for (const [cid, c] of Object.entries(competitions as Record<string, any>)) {
      if (c?.organisations?.[organisationId]) updates[`competitions/${cid}/organisations/${organisationId}`] = null;
    }
    await db.update(updates);
  };
}

/** Invites to help run an organisation, emailed like a competition's. */
export class OrganisationInvites extends FirebaseInvites {
  async handleCreate(snap: any, ctx: any) {
    // Organisations are v4's, so this is always the v4 email, linking to the
    // site the invite was sent from (utility/emailModel.ts). An invite from
    // before it said goes to V4_SITE.
    const { organisationId, inviteId } = ctx.params;
    const invite = snap.val();
    const from = sentFrom(invite.origin || V4_SITE);
    const link = `${from.url}/organisations/${organisationId}/invites/${inviteId}`;
    const organisation = (await this.config.db.child(`organisations/${organisationId}`).once('value')).val();
    const inviter = await firstName(this.config.db, invite.createdBy);
    try {
      await getPostmark().sendEmailWithTemplate({
        From: this.config.email,
        To: isEmulator() ? this.config.email : invite.payload.email,
        ...sendOptions('organisation-invite'),
        TemplateModel: {
          app: appModel(this.config, from),
          organisation: { ...organisation, mark: organisationMark(organisation ?? undefined) },
          inviter: inviter && { name: inviter },
          invite: { ...invite, link },
        },
      });
      if (invite.emailFailed) await snap.ref.update({ emailFailed: null });
    } catch (err) {
      console.error('organisation invite email failed', err);
      // The invite stands without its email: flag it (unless it's gone) so
      // its admins can send the link another way.
      if ((await snap.ref.child('created').once('value')).exists()) {
        await snap.ref.update({ emailFailed: new Date().toISOString() });
      }
    }
  }

  async attach(snap: any, ctx: any, value: true | null) {
    const userId = snap.val()?.[FirebaseInvites.keys.acceptedBy];
    if (userId) await attachUserToOrganisation({ db: this.config.db, userId, organisationId: ctx.params.organisationId, value });
  }

  async handleAccept(snap: any, ctx: any) {
    await this.attach(snap, ctx, true);
  }

  async handleDelete(snap: any, ctx: any) {
    await this.attach(snap, ctx, null);
  }
}
