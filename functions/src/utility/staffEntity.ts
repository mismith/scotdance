// Bundle of Typesense + aggregator wiring for staff-type entities (judges,
// pipers). Judges and pipers are structurally identical — same staff source
// path, same denorm fields, same Typesense schema — so they share this
// factory and differ only by `staffType`, `namespace`, and `backPointerField`.

import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isCypress } from './env';
import { ensureAdmin } from './competition';
import { getTypesense, indexBestEffort, sameExcept } from './typesense';
import { createAggregator } from './aggregate';
import {
  personName, staffAggregator, type StaffEntityKind, type StaffRecord,
} from './entityConfigs';

function staffDocId(competitionId: string, staffId: string) {
  return `${competitionId}:${staffId}`;
}

export function createStaffEntity(config: StaffEntityKind) {
  const { staffType, namespace } = config;

  const schema: CollectionCreateSchema = {
    name: namespace,
    fields: [
      { name: '$competitionId', type: 'string', facet: true },
      { name: '$name', type: 'string', facet: true },
      { name: 'firstName', type: 'string', optional: true },
      { name: 'lastName', type: 'string', optional: true },
      { name: 'location', type: 'string', optional: true },
      {
        name: 'image', type: 'string', optional: true, index: false,
      },
    ],
  };

  const isMatch = (m: StaffRecord | null | undefined): m is StaffRecord => (
    !!m && m.type === staffType
  );

  function docFor(member: StaffRecord, ctx: { competitionId: string; staffId: string }) {
    return {
      id: staffDocId(ctx.competitionId, ctx.staffId),
      $competitionId: ctx.competitionId,
      $name: personName(member),
      firstName: member.firstName,
      lastName: member.lastName,
      location: member.location,
      image: member.image,
    };
  }

  async function safeDelete(docId: string) {
    await getTypesense().collections(namespace).documents(docId).delete()
      .catch(() => {});
  }

  const aggregatorConfig = staffAggregator(config);

  function getOnCreate(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onCreate(snap: any, ctx: any) {
      if (isCypress()) return;
      const member = snap.val();
      if (isMatch(member)) {
        const { competitionId, staffId } = ctx.params;
        await indexBestEffort(`${namespace} upsert`, () => getTypesense()
          .collections(namespace)
          .documents()
          .upsert(docFor(member, { competitionId, staffId })));
      }
      await agg.onCreate(snap, ctx);
    };
  }

  function getOnUpdate(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onUpdate(change: any, ctx: any) {
      if (isCypress()) return;
      const member = change.after.val();
      const prev = change.before.val();
      const { competitionId, staffId } = ctx.params;
      if (isMatch(member)) {
        // Back-pointer writes change nothing search uses.
        if (!sameExcept(prev, member, ['judgeId', 'piperId'])) {
          await indexBestEffort(`${namespace} upsert`, () => getTypesense()
            .collections(namespace)
            .documents()
            .upsert(docFor(member, { competitionId, staffId })));
        }
      } else if (isMatch(prev)) {
        await safeDelete(staffDocId(competitionId, staffId));
      }
      await agg.onUpdate(change, ctx);
    };
  }

  function getOnDelete(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onDelete(snap: any, ctx: any) {
      if (isCypress()) return;
      const { competitionId, staffId } = ctx.params;
      if (isMatch(snap.val())) await safeDelete(staffDocId(competitionId, staffId));
      await agg.onDelete(snap, ctx);
    };
  }

  function getOnReindex(db: any) {
    return async function onReindex(_data: unknown, ctx: any) {
      await ensureAdmin(ctx, db);
      await getTypesense().collections(namespace).delete().catch(() => {});
      await getTypesense().collections().create(schema);
      const competitions = (await db.child('competitions').get()).val() || {};
      const documents: any[] = [].concat(...(await Promise.all(Object.keys(competitions).map(
        async (competitionId) => {
          const staff = (await db.child(`competitions:data/${competitionId}/staff`).get()).val() || {};
          return Object.entries(staff)
            .filter(([, member]) => isMatch(member as StaffRecord))
            .map(([staffId, member]) => (
              docFor(member as StaffRecord, { competitionId, staffId })
            )) as never;
        },
      ))));
      if (documents.length) {
        await getTypesense().collections(namespace).documents().import(documents, { action: 'upsert' });
      }
      return documents;
    };
  }

  function getOnBackfillAggregates(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onBackfillAggregates(_data: unknown, ctx: any) {
      await ensureAdmin(ctx, db);
      return agg.backfill();
    };
  }

  function getOnBackfillBackPointers(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onBackfillBackPointers(data: unknown, ctx: any) {
      await ensureAdmin(ctx, db);
      const opts = (data ?? {}) as { batchSize?: number };
      return agg.backfillBackPointers(opts);
    };
  }

  /** Link or unlink a competition's staff after it's listed, published or hidden again. */
  function getOnSyncCompetition(db: any) {
    return createAggregator(db, aggregatorConfig).syncCompetition;
  }

  return {
    schema,
    getOnCreate,
    getOnUpdate,
    getOnDelete,
    getOnReindex,
    getOnBackfillAggregates,
    getOnBackfillBackPointers,
    getOnSyncCompetition,
  };
}
