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
</style>
