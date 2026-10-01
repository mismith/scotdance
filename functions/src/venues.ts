import { ensureAdmin } from './utility/competition';
import { createAggregator } from './utility/aggregate';
import { venueAggregator as aggregatorConfig } from './utility/entityConfigs';

// Venue aggregator: maintains /venues and /venues:index from competition meta
// writes (config in utility/entityConfigs).
//
// See docs/adr/0003-first-class-entities.md.

export function getOnCreate(db: any) {
  return createAggregator(db, aggregatorConfig).onCreate;
}

export function getOnUpdate(db: any) {
  return createAggregator(db, aggregatorConfig).onUpdate;
}

export function getOnDelete(db: any) {
  return createAggregator(db, aggregatorConfig).onDelete;
}

export function getOnBackfillAggregates(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onBackfillAggregates(_data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);
    return agg.backfill();
  };
}

export function getOnBackfillBackPointers(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onBackfillBackPointers(data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);
    const opts = (data ?? {}) as { batchSize?: number };
    return agg.backfillBackPointers(opts);
  };
}
