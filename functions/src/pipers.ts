import { createStaffEntity } from './utility/staffEntity';

export const PIPER_TYPE = 'Piper';

const entity = createStaffEntity({
  staffType: PIPER_TYPE,
  namespace: 'pipers',
  backPointerField: 'piperId',
});

export const {
  schema,
  getOnCreate,
  getOnUpdate,
  getOnDelete,
  getOnReindex,
  getOnBackfillAggregates,
} = entity;
