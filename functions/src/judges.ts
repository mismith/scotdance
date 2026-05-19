import { createStaffEntity } from './utility/staffEntity';

export const JUDGE_TYPE = 'Judge';

const entity = createStaffEntity({
  staffType: JUDGE_TYPE,
  namespace: 'judges',
  backPointerField: 'judgeId',
});

export const {
  schema,
  getOnCreate,
  getOnUpdate,
  getOnDelete,
  getOnReindex,
  getOnBackfillAggregates,
  getOnBackfillBackPointers,
} = entity;
