import { inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue';
import { get, child, ref as dbRefFn } from 'firebase/database';
import { database, dataRef } from '@/firebase';
import type { Competition, StaffMember } from '@/types/competition';

interface CompetitionContext {
  competitionId: Ref<string>;
  competition: Ref<Competition | null>;
  notFound: Ref<boolean>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  staff: Ref<StaffMember[]>;
  loadStaff: () => Promise<void>;
}

const competitionKey = Symbol('competition') as InjectionKey<CompetitionContext>;

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production';

function competitionMetaRef(id: string) {
  return child(dataRef('competitions'), id);
}

function competitionStaffRef(id: string) {
  // RTDB path uses `competitions:data` (sibling to `competitions`)
  return dbRefFn(database, `${NAMESPACE}/competitions:data/${id}/staff`);
}

function snapshotToArray<T extends { id: string }>(value: Record<string, Omit<T, 'id'>> | null): T[] {
  if (!value) return [];
  return Object.entries(value).map(([id, v]) => ({ id, ...v } as T));
}

export function provideCompetition(competitionId: Ref<string>): CompetitionContext {
  const competition = ref<Competition | null>(null);
  const notFound = ref(false);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const staff = ref<StaffMember[]>([]);

  let staffLoaded = false;

  async function loadMeta() {
    if (!competitionId.value) return;
    loading.value = true;
    error.value = null;
    notFound.value = false;
    competition.value = null;
    staff.value = [];
    staffLoaded = false;
    try {
      const snap = await get(competitionMetaRef(competitionId.value));
      const value = snap.val() as Competition | null;
      if (!value || typeof value !== 'object') {
        notFound.value = true;
      } else {
        competition.value = value;
      }
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  }

  async function loadStaff() {
    if (staffLoaded || !competitionId.value) return;
    try {
      const snap = await get(competitionStaffRef(competitionId.value));
      staff.value = snapshotToArray<StaffMember>(snap.val()).sort(
        (a, b) => (a._order ?? 0) - (b._order ?? 0),
      );
      staffLoaded = true;
    } catch (e) {
      error.value = e as Error;
    }
  }

  watch(competitionId, loadMeta, { immediate: true });

  const ctx: CompetitionContext = {
    competitionId,
    competition,
    notFound,
    loading,
    error,
    staff,
    loadStaff,
  };

  provide(competitionKey, ctx);
  return ctx;
}

export function useCompetition(): CompetitionContext {
  const ctx = inject(competitionKey);
  if (!ctx) {
    throw new Error('useCompetition() must be called inside a route under /competitions/:competitionId');
  }
  return ctx;
}
