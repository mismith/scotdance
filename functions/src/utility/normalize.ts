// Canonical name normalization for aggregate identity keys.
//
// Used by both the trigger side (judges/pipers/venues/dancers aggregators)
// and the read side (frontend `entityIndex.ts`): one implementation, in shared/.

export { normalizeName } from '../../../shared/normalize';
