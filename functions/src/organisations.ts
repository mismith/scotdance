import { HttpsError } from 'firebase-functions/v2/https';
import { FirebaseInvites } from '@mismith/firebase-tools/dist/server';
import { getPostmark } from './utility/email';
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
}

/** Makes an organisation. Whoever it's made for becomes its admin. */
export async function createOrganisation(db: any, { name, shortName }: NewOrganisation, createdBy: string, adminId: string | null = createdBy) {
  const record = {
    name: text(name, 120),
    shortName: text(shortName, 24) || null,
    created: new Date().toISOString(),
    createdBy,
  };
  if (!record.name) throw new HttpsError('invalid-argument', 'An organisation needs a name.');
  const ref = db.child('organisations').push();
  await ref.set(record);
  if (adminId) await attachUserToOrganisation({ db, userId: adminId, organisationId: ref.key });
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
    const join = !(isAdmin && data?.join === false);
    const organisationId = await createOrganisation(db, data ?? {}, uid, join ? uid : null);
    const competitionId = typeof data?.competitionId === 'string' ? data.competitionId : null;
    // Only to a competition that's there: writing to a deleted one would bring it back as an empty record.
    if (competitionId && (isAdmin || perms.competitions?.[competitionId] === true)
      && (await db.child(`competitions/${competitionId}/date`).get()).exists()) {
      await db.child(`competitions/${competitionId}/organisations/${organisationId}`).set(true);
    }
    return { organisationId };
  };
}

/**
 * The organisations an approved submission asked for: those it picked, if
 * they still exist, and new ones, made now with the submitter as their
 * admin. Returns their ids, to list the new competition under.
 */
export async function organisationsForSubmission(db: any, submission: any): Promise<string[]> {
  const picked = Object.keys(submission?.organisations || {});
  const exists = await Promise.all(picked.map(async (id) => (await db.child(`organisations/${id}/name`).get()).exists()));
  const ids = picked.filter((_, i) => exists[i]);
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
    const { organisationId, inviteId } = ctx.params;
    const link = `${this.config.url}/organisations/${organisationId}/invites/${inviteId}`;
    const invite = snap.val();
    const organisation = (await this.config.db.child(`organisations/${organisationId}`).once('value')).val();
    try {
      await getPostmark().sendEmailWithTemplate({
        From: this.config.email,
        To: isEmulator() ? this.config.email : invite.payload.email,
        TemplateAlias: 'organisation-admin-invite',
        TemplateModel: {
          app: {
            name: this.config.name,
            description: this.config.description,
            email: this.config.email,
            url: this.config.url,
          },
          organisation,
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
