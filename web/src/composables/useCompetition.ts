import { inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue';
import { get, child, ref as dbRefFn } from 'firebase/database';
import { database, dataRef } from '@/firebase';
import {
  danceFullName,
  dancerFullName,
  groupFullName,
  type Category,
  type Competition,
  type Dance,
  type Dancer,
  type EnrichedDance,
  type EnrichedDancer,
  type EnrichedGroup,
  type Group,
  type PointsTree,
  type ResultsTree,
  type StaffMember,
} from '@/types/competition';

interface CompetitionContext {
  competitionId: Ref<string>;
  competition: Ref<Competition | null>;
  notFound: Ref<boolean>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  staff: Ref<StaffMember[]>;
  loadStaff: () => Promise<void>;
  dancers: Ref<EnrichedDancer[]>;
  loadDancers: () => Promise<void>;
  dances: Ref<EnrichedDance[]>;
  results: Ref<ResultsTree>;
  points: Ref<PointsTree>;
  loadResults: () => Promise<void>;
}

const competitionKey = Symbol('competition') as InjectionKey<CompetitionContext>;

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production';

function competitionMetaRef(id: string) {
  return child(dataRef('competitions'), id);
}

function competitionDataPath(id: string, section: string) {
  return `${NAMESPACE}/competitions:data/${id}/${section}`;
}

function competitionStaffRef(id: string) {
  return dbRefFn(database, competitionDataPath(id, 'staff'));
}

function competitionSectionRef(
  id: string,
  section: 'dancers' | 'groups' | 'categories' | 'dances' | 'results' | 'points',
) {
  return dbRefFn(database, competitionDataPath(id, section));
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
  const dancers = ref<EnrichedDancer[]>([]);
  const dances = ref<EnrichedDance[]>([]);
  const results = ref<ResultsTree>({});
  const points = ref<PointsTree>({});

  let staffLoaded = false;
  let dancersLoaded = false;
  let resultsLoaded = false;

  async function loadMeta() {
    if (!competitionId.value) return;
    loading.value = true;
    error.value = null;
    notFound.value = false;
    competition.value = null;
    staff.value = [];
    staffLoaded = false;
    dancers.value = [];
    dancersLoaded = false;
    dances.value = [];
    results.value = {};
    points.value = {};
    resultsLoaded = false;
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

  async function loadDancers() {
    if (dancersLoaded || !competitionId.value) return;
    const id = competitionId.value;
    try {
      const [dancersSnap, groupsSnap, categoriesSnap] = await Promise.all([
        get(competitionSectionRef(id, 'dancers')),
        get(competitionSectionRef(id, 'groups')),
        get(competitionSectionRef(id, 'categories')),
      ]);

      const rawDancers = snapshotToArray<Dancer>(dancersSnap.val());
      const rawGroups = snapshotToArray<Group>(groupsSnap.val());
      const rawCategories = snapshotToArray<Category>(categoriesSnap.val());

      const categoriesById = new Map(rawCategories.map((c) => [c.id, c]));
      const enrichedGroupsById = new Map<string, EnrichedGroup>(
        rawGroups.map((g) => {
          const category = g.categoryId ? categoriesById.get(g.categoryId) : undefined;
          return [g.id, { ...g, category, fullName: groupFullName(g, category) }];
        }),
      );

      dancers.value = rawDancers
        .filter((d) => d.firstName || d.lastName)
        .map<EnrichedDancer>((d) => ({
          ...d,
          fullName: dancerFullName(d),
          group: d.groupId ? enrichedGroupsById.get(d.groupId) : undefined,
        }));

      dancersLoaded = true;
    } catch (e) {
      error.value = e as Error;
    }
  }

  async function loadResults() {
    if (resultsLoaded || !competitionId.value) return;
    const id = competitionId.value;
    try {
      const [dancesSnap, resultsSnap, pointsSnap] = await Promise.all([
        get(competitionSectionRef(id, 'dances')),
        get(competitionSectionRef(id, 'results')),
        get(competitionSectionRef(id, 'points')),
      ]);

      const rawDances = snapshotToArray<Dance>(dancesSnap.val());
      dances.value = rawDances
        .map<EnrichedDance>((d) => ({ ...d, fullName: danceFullName(d) }))
        .sort((a, b) => (a._order ?? 0) - (b._order ?? 0));

      results.value = (resultsSnap.val() as ResultsTree | null) ?? {};
      points.value = (pointsSnap.val() as PointsTree | null) ?? {};

      resultsLoaded = true;
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
    dancers,
    loadDancers,
    dances,
    results,
    points,
    loadResults,
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
