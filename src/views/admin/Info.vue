<template>
  <AdminSubsections
    :section="section"
    class="AdminInfo"
  >
    <template #form="{ currentSubsection }">
      <template v-if="currentSubsection">
        <MiHotTable
          v-if="currentSubsection.hot"
          :settings="currentSubsection.hot"
          :data="toOrderedArray(info[subsectionId])"
          @change="handleSubsectionChange"
        />
        <DynamicForm
          v-else-if="currentSubsection.fields"
          :fields="currentSubsection.fields"
          :data="info[subsectionId]"
          @field-change="handleSubsectionChange"
          class="pa-4"
        />
        <div v-else-if="subsectionId === 'indexes'" class="pa-4">
          <div class="ma-auto d-flex flex-column" style="gap: 1.5rem; max-width: 640px;">
            <v-card class="pa-4">
              <h2 class="subtitle-1 font-weight-medium mb-1">Published-competitions flag</h2>
              <p class="caption grey--text mb-3">
                Rebuilds the tiny <code>competitions:published</code> list from each
                competition's <code>published</code> flag. The public app reads
                this to know which comps to show. Re-run after manually fixing
                a <code>published</code> value in RTDB.
              </p>
              <div class="d-flex flex-column" style="gap: 0.5rem;">
                <v-btn
                  :loading="indexJobs.competitionsPublished.loading"
                  @click="runReindex('competitionsPublished')"
                >
                  Rebuild published flag
                </v-btn>
                <div v-if="indexJobs.competitionsPublished.count != null" class="caption grey--text">
                  {{ indexJobs.competitionsPublished.count.toLocaleString() }} published competitions
                </div>
              </div>
            </v-card>

            <v-card class="pa-4">
              <h2 class="subtitle-1 font-weight-medium mb-1">Search indexes (Typesense)</h2>
              <p class="caption grey--text mb-3">
                Wipes and rebuilds the search index that powers the search bar.
                Re-run if results look stale or missing after a schema change.
                Slow on the dancers index — it scans every per-comp record.
              </p>
              <div class="d-flex flex-column" style="gap: 0.75rem;">
                <div
                  v-for="entry in searchIndexEntities"
                  :key="entry.key"
                  class="d-flex flex-column"
                  style="gap: 0.25rem;"
                >
                  <v-btn
                    :loading="indexJobs[entry.key].loading"
                    @click="runReindex(entry.key)"
                  >
                    Rebuild {{ entry.label }} index
                  </v-btn>
                  <div v-if="indexJobs[entry.key].count != null" class="caption grey--text">
                    {{ indexJobs[entry.key].count.toLocaleString() }} {{ entry.label.toLowerCase() }} indexed
                  </div>
                </div>
              </div>
            </v-card>

            <v-alert :value="Boolean(hasError)" type="error">{{ hasError }}</v-alert>
          </div>
        </div>
        <div v-else-if="subsectionId === 'aggregators'" class="pa-4">
          <div class="ma-auto d-flex flex-column" style="gap: 1.5rem; max-width: 640px;">
            <p class="caption grey--text mb-0">
              Builds the cross-comp profile for each entity (e.g. one
              <code>/judges/{id}</code> per real judge, with appearances across
              all their comps). One card per entity — run the steps top-down.
              Idempotent: safe to re-run.
            </p>

            <v-card
              v-for="entity in aggregatorEntities"
              :key="entity.key"
              class="pa-4"
            >
              <h2 class="subtitle-1 font-weight-medium mb-3">{{ entity.label }}</h2>

              <!-- Step 1: build aggregate + index -->
              <div class="d-flex align-start mb-4" style="gap: 0.75rem;">
                <span
                  class="step-dot mt-1"
                  :class="aggregatorJobs[entity.key].result ? 'step-dot--done' : 'step-dot--todo'"
                >1</span>
                <div class="flex-grow-1">
                  <div class="subtitle-2 font-weight-medium">Build profile + lookup index</div>
                  <p class="caption grey--text mb-2">
                    Scans every comp, merges duplicates by {{ entity.identityHint }},
                    and writes one record per real {{ entity.singular }} into
                    <code>/{{ entity.key }}</code>.
                  </p>
                  <v-btn
                    small
                    :loading="aggregatorJobs[entity.key].loading"
                    @click="runBackfillAggregate(entity.key)"
                  >
                    Build {{ entity.singular }} profiles
                  </v-btn>
                  <div
                    v-if="aggregatorJobs[entity.key].result"
                    class="caption grey--text mt-2"
                  >
                    Linked {{ aggregatorJobs[entity.key].result.linked.toLocaleString() }}
                    {{ entity.label.toLowerCase() }}<template
                      v-if="aggregatorJobs[entity.key].result.skipped"
                    >, skipped {{ aggregatorJobs[entity.key].result.skipped.toLocaleString() }}
                    ({{ entity.ignoredLabel }})</template><template
                      v-if="aggregatorJobs[entity.key].result.pruned"
                    >, pruned {{ aggregatorJobs[entity.key].result.pruned.toLocaleString() }}
                    stale</template>,
                    across {{ aggregatorJobs[entity.key].result.competitions.toLocaleString() }} comps.
                  </div>
                </div>
              </div>

              <!-- Step 2: write back-pointers -->
              <div class="d-flex align-start" style="gap: 0.75rem;">
                <span
                  class="step-dot mt-1"
                  :class="[
                    !canBackfillBackPointers(entity.key) && 'step-dot--blocked',
                    canBackfillBackPointers(entity.key) && backPointerJobs[entity.key].result && 'step-dot--done',
                    canBackfillBackPointers(entity.key) && !backPointerJobs[entity.key].result && 'step-dot--todo',
                  ]"
                >2</span>
                <div class="flex-grow-1">
                  <div class="subtitle-2 font-weight-medium">Write back-pointers</div>
                  <p class="caption grey--text mb-2">
                    Stamps each per-comp record with its profile&nbsp;ID
                    (<code>{{ entity.backPointerField }}</code>). Lets the public
                    app jump from a per-comp page to the cross-comp profile
                    (and power the favourite button). Batched, idempotent — the
                    <code>already&nbsp;set</code> counter doubles as a preview
                    on re-run.
                  </p>
                  <v-btn
                    small
                    color="primary"
                    :disabled="!canBackfillBackPointers(entity.key) || backPointerJobs[entity.key].loading"
                    :loading="backPointerJobs[entity.key].loading"
                    @click="runBackfillBackPointers(entity.key)"
                  >
                    Write pointers
                  </v-btn>
                  <div
                    v-if="backPointerJobs[entity.key].result"
                    class="caption grey--text mt-2"
                  >
                    Wrote {{ backPointerJobs[entity.key].result.written.toLocaleString() }}
                    in {{ backPointerJobs[entity.key].result.batches.toLocaleString() }}
                    batch{{ backPointerJobs[entity.key].result.batches === 1 ? '' : 'es' }},
                    {{ backPointerJobs[entity.key].result.alreadySet.toLocaleString() }} already set<template
                      v-if="backPointerJobs[entity.key].result.unmatched"
                    >, {{ backPointerJobs[entity.key].result.unmatched.toLocaleString() }}
                    unmatched (no profile found — re-run step&nbsp;1)</template>.
                  </div>
                  <div
                    v-else-if="!canBackfillBackPointers(entity.key)"
                    class="caption amber--text text--darken-2 mt-2"
                  >
                    Locked until step&nbsp;1 succeeds.
                  </div>
                </div>
              </div>
            </v-card>

            <v-alert :value="Boolean(hasError)" type="error">{{ hasError }}</v-alert>
          </div>
        </div>
        <div v-else-if="subsectionId === 'geolocation'" class="pa-4">
          <div class="ma-auto d-flex flex-column" style="gap: 1.5rem; max-width: 560px;">
            <div v-if="statsLoading" class="text-center grey--text">Counting…</div>
            <div v-else-if="stats" class="d-flex" style="gap: 0.5rem;">
              <div class="flex stat-tile">
                <div class="display-1 font-weight-medium">{{ stats.total.toLocaleString() }}</div>
                <div class="caption grey--text">Total</div>
              </div>
              <div class="flex stat-tile">
                <div class="display-1 font-weight-medium green--text">{{ stats.withCoords.toLocaleString() }}</div>
                <div class="caption grey--text">With coords</div>
              </div>
              <div class="flex stat-tile">
                <div
                  class="display-1 font-weight-medium"
                  :class="stats.missingCoords ? 'amber--text text--darken-2' : 'grey--text'"
                >
                  {{ stats.missingCoords.toLocaleString() }}
                </div>
                <div class="caption grey--text">Missing</div>
              </div>
              <div class="flex stat-tile">
                <div
                  class="display-1 font-weight-medium"
                  :class="stats.unqueryable ? 'red--text' : 'grey--text'"
                >
                  {{ stats.unqueryable.toLocaleString() }}
                </div>
                <div class="caption grey--text">No address</div>
              </div>
            </div>

            <div v-if="stats && stats.missingList.length">
              <h2 class="title mb-2">Errors</h2>
              <ul class="pl-4 caption" style="text-align: left;">
                <li v-for="row in stats.missingList" :key="row.id">
                  <router-link
                    :to="{ name: 'competition.admin.info', params: { competitionId: row.id } }"
                  >
                    <strong>{{ row.name || row.id }}</strong>
                  </router-link>
                  <span v-if="row.query" class="grey--text"> — {{ row.query }}</span>
                  <em v-else class="red--text"> — no address</em>
                </li>
              </ul>
            </div>

            <div class="d-flex justify-center" style="gap: 0.5rem;">
              <v-btn :loading="isBackfillingCoords && lastBackfillDryRun" @click="handleBackfillCoords(true)">Dry run</v-btn>
              <v-btn
                color="primary"
                :loading="isBackfillingCoords && !lastBackfillDryRun"
                :disabled="!stats || !stats.missingCoords"
                @click="handleBackfillCoords(false)"
              >
                Backfill
              </v-btn>
            </div>

            <div v-if="backfillSummary" class="caption text-center">
              {{ backfillSummary.updated.toLocaleString() }} updated /
              {{ backfillSummary.skipped.toLocaleString() }} already-coded /
              {{ backfillSummary.noQuery.toLocaleString() }} no address /
              {{ backfillSummary.failed.toLocaleString() }} failed
              (of {{ backfillSummary.scanned.toLocaleString() }} scanned)
              <em v-if="backfillSummary.dryRun"> — dry-run, nothing written</em>
            </div>
            <v-alert :value="Boolean(hasError)" type="error">{{ hasError }}</v-alert>
          </div>
        </div>
      </template>
      <EmptyState
        v-else
        :icon="mdiCogBox"
        label="App Admin"
      />
    </template>
  </AdminSubsections>
</template>

<script>
import { mdiCogBox, mdiCalendarMultiple } from '@mdi/js';
import {
  idKey,
  toOrderedArray,
  fns,
  db,
} from '@/helpers/firebase';
import { mapRouteParams } from '@/helpers/router';
import AdminSubsections from '@/components/admin/Subsections.vue';
import MiHotTable from '@/components/admin/MiHotTable.vue';
import DynamicForm from '@/components/admin/DynamicForm.vue';

const backfillCoords = fns.httpsCallable('backfillCoords');
const reindexCallables = {
  competitionsPublished: fns.httpsCallable('reindexCompetitionsPublished'),
  competitions: fns.httpsCallable('reindexCompetitions'),
  dancers: fns.httpsCallable('reindexDancers'),
  judges: fns.httpsCallable('reindexJudges'),
  pipers: fns.httpsCallable('reindexPipers'),
};
function reindexCount(key, data) {
  if (key === 'competitionsPublished') return Object.keys(data || {}).length;
  return Array.isArray(data) ? data.length : 0;
}

// Aggregator backfills — rebuild /{entity} and /{entity}:index trees from
// per-comp records. Functions live in functions/src/{judges,pipers,venues,dancers}.ts.
const aggregatorCallables = {
  judges: fns.httpsCallable('backfillJudgeAggregates'),
  pipers: fns.httpsCallable('backfillPiperAggregates'),
  venues: fns.httpsCallable('backfillVenueAggregates'),
  dancers: fns.httpsCallable('backfillDancerAggregates'),
};
// Back-pointer backfills — writes the {judgeId,piperId,venueId,dancerId} field
// onto each source record. Prereq: aggregator backfill above has run so the
// /{entity}:index is populated for lookup.
const backPointerCallables = {
  judges: fns.httpsCallable('backfillJudgeBackPointers'),
  pipers: fns.httpsCallable('backfillPiperBackPointers'),
  venues: fns.httpsCallable('backfillVenueBackPointers'),
  dancers: fns.httpsCallable('backfillDancerBackPointers'),
};
const aggregatorEntitiesList = [
  {
    key: 'judges',
    label: 'Judges',
    singular: 'judge',
    ignoredLabel: 'staff not marked as judges',
    identityHint: 'first + last name',
    backPointerField: 'judgeId',
  },
  {
    key: 'pipers',
    label: 'Pipers',
    singular: 'piper',
    ignoredLabel: 'staff not marked as pipers',
    identityHint: 'first + last name',
    backPointerField: 'piperId',
  },
  {
    key: 'venues',
    label: 'Venues',
    singular: 'venue',
    ignoredLabel: 'competitions without a venue',
    identityHint: 'venue name + locality',
    backPointerField: 'venueId',
  },
  {
    key: 'dancers',
    label: 'Dancers',
    singular: 'dancer',
    ignoredLabel: 'dancers with no name',
    identityHint: 'first + last name',
    backPointerField: 'dancerId',
  },
];

const searchIndexEntitiesList = [
  { key: 'competitions', label: 'Competitions' },
  { key: 'dancers', label: 'Dancers' },
  { key: 'judges', label: 'Judges' },
  { key: 'pipers', label: 'Pipers' },
];

export default {
  name: 'AdminInfo',
  reactiveInject: {
    adminBundle: [
      'section',
      'versions',
    ],
  },
  data() {
    return {
      idKey,
      mdiCogBox,
      mdiCalendarMultiple,

      isBackfillingCoords: false,
      lastBackfillDryRun: false,
      backfillSummary: null,
      hasError: false,

      stats: null,
      statsLoading: false,

      indexJobs: {
        competitionsPublished: { loading: false, count: null },
        competitions: { loading: false, count: null },
        dancers: { loading: false, count: null },
        judges: { loading: false, count: null },
        pipers: { loading: false, count: null },
      },

      aggregatorEntities: aggregatorEntitiesList,
      searchIndexEntities: searchIndexEntitiesList,
      aggregatorJobs: {
        judges: { loading: false, result: null },
        pipers: { loading: false, result: null },
        venues: { loading: false, result: null },
        dancers: { loading: false, result: null },
      },
      backPointerJobs: {
        judges: { loading: false, result: null },
        pipers: { loading: false, result: null },
        venues: { loading: false, result: null },
        dancers: { loading: false, result: null },
      },
    };
  },
  watch: {
    subsectionId: {
      immediate: true,
      handler(id) {
        if (id === 'geolocation') this.loadStats();
      },
    },
  },
  computed: {
    ...mapRouteParams([
      'subsectionId',
    ]),

    info() {
      return {
        versions: this.versions,
      };
    },
  },
  methods: {
    toOrderedArray,

    handleSubsectionChange(changes) {
      const subsectionChanges = Object.entries(changes).reduce((acc, [path, change]) => {
        acc[`${this.subsectionId}/${path}`] = change;
        return acc;
      }, {});
      this.$emit('change', subsectionChanges);
    },

    async runReindex(key) {
      const job = this.indexJobs[key];
      if (!job || job.loading) return;
      this.hasError = false;
      job.loading = true;
      try {
        const { data } = await reindexCallables[key]();
        job.count = reindexCount(key, data);
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      job.loading = false;
    },

    async runBackfillAggregate(key) {
      const job = this.aggregatorJobs[key];
      if (!job || job.loading) return;
      this.hasError = false;
      job.loading = true;
      try {
        const { data } = await aggregatorCallables[key]();
        // Functions return { linked, skipped, pruned, competitions }; defensive
        // defaults so the UI doesn't blow up if a future change drops a field.
        this.$set(job, 'result', {
          linked: data?.linked ?? 0,
          skipped: data?.skipped ?? 0,
          pruned: data?.pruned ?? 0,
          competitions: data?.competitions ?? 0,
        });
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      job.loading = false;
    },

    canBackfillBackPointers(key) {
      // Gate on a successful aggregator run that actually linked something —
      // back-pointers resolve through /{entity}:index, which the aggregator
      // builds.
      const aggResult = this.aggregatorJobs[key]?.result;
      return Boolean(aggResult && aggResult.linked > 0);
    },

    async runBackfillBackPointers(key) {
      const job = this.backPointerJobs[key];
      if (!job || job.loading) return;
      if (!this.canBackfillBackPointers(key)) return;
      this.hasError = false;
      job.loading = true;
      try {
        const { data } = await backPointerCallables[key]();
        this.$set(job, 'result', {
          written: data?.written ?? 0,
          alreadySet: data?.alreadySet ?? 0,
          unmatched: data?.unmatched ?? 0,
          competitions: data?.competitions ?? 0,
          batches: data?.batches ?? 0,
        });
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      job.loading = false;
    },

    async handleBackfillCoords(dryRun) {
      this.hasError = false;
      this.isBackfillingCoords = true;
      this.lastBackfillDryRun = dryRun;
      try {
        const { data } = await backfillCoords({ dryRun });
        this.$set(this, 'backfillSummary', data);
        if (!dryRun) await this.loadStats();
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      this.isBackfillingCoords = false;
    },

    async loadStats() {
      this.statsLoading = true;
      try {
        const snap = await db.child('competitions').once('value');
        const all = snap.val() || {};
        let total = 0;
        let withCoords = 0;
        let unqueryable = 0;
        const missingList = [];
        Object.entries(all).forEach(([id, c]) => {
          total += 1;
          if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
            withCoords += 1;
            return;
          }
          const query = [c.venue, c.address, c.location].filter(Boolean).join(', ');
          missingList.push({ id, name: c.name, query });
          if (!query) unqueryable += 1;
        });
        this.$set(this, 'stats', {
          total,
          withCoords,
          missingCoords: total - withCoords,
          unqueryable,
          missingList,
        });
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      this.statsLoading = false;
    },
  },
  components: {
    AdminSubsections,
    MiHotTable,
    DynamicForm,
  },
};
</script>

<style lang="scss" scoped>
.stat-tile {
  background-color: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 0.75rem 0.5rem;
  text-align: center;
}

.step-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;

  &--todo {
    background-color: rgba(0, 0, 0, 0.08);
    color: rgba(0, 0, 0, 0.55);
  }

  &--done {
    background-color: #43a047;
    color: #fff;
  }

  &--blocked {
    background-color: rgba(0, 0, 0, 0.04);
    color: rgba(0, 0, 0, 0.3);
  }
}

code {
  background-color: rgba(0, 0, 0, 0.04);
  padding: 0 0.25rem;
  border-radius: 3px;
  font-size: 0.85em;
}
</style>
