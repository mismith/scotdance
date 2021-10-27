<template>
  <Blades class="CompetitionAdminDanceGroups" stacks>
    <Blade id="blade-groups" :active="!currentGroup" class="col-md-4 app-scroll">
      <v-list v-if="groups.length">
        <v-list-item
          v-for="group in groups"
          :key="group[idKey]"
          :to="{ name: $route.name, params: { groupId: group[idKey] } }"
          :class="{ active: isActive(group) }"
        >
          <v-list-item-content>
            <v-list-item-title>{{ group.$name }}</v-list-item-title>
          </v-list-item-content>
          <v-icon>{{ mdiChevronRight }}</v-icon>
        </v-list-item>
      </v-list>
      <EmptyState
        v-else
        :icon="mdiAlert"
        label="No age groups found"
      >
        <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'groups' } }">
          <span class="subtitle-1">Add or import some first &rsaquo;</span>
        </router-link>
      </EmptyState>
    </Blade>
    <Blade id="blade-dances" :active="currentGroup" class="col-md-4 app-scroll">
      <v-list v-if="currentGroup && dances.length">
        <v-list-item
          v-for="dance in dances"
          :key="dance[idKey]"
          @click="handleDanceToggle(dance, !dance.groupIds[groupId])"
        >
          <v-list-item-content>
            <v-list-item-title>{{ dance.$name }}</v-list-item-title>
          </v-list-item-content>
          <v-list-item-action>
            <v-switch :input-value="!!dance.groupIds[groupId]" />
          </v-list-item-action>
        </v-list-item>

        <template>
          <v-divider />
          <footer class="pa-3">
            <v-btn text @click="handleCopy">
              Copy
            </v-btn>
            <v-btn text :disabled="clipboard.type !== 'dance-groups'" @click="handlePaste">
              Paste
            </v-btn>
          </footer>
        </template>
      </v-list>
      <EmptyState
        v-else-if="currentGroup"
        :icon="mdiAlert"
        label="No dances found"
      >
        <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'dances' } }">
          <span class="subtitle-1">Add or import some first &rsaquo;</span>
        </router-link>
      </EmptyState>
      <EmptyState
        v-else
        :icon="mdiSourcePull"
        label="Link dances"
        description="Pick dances for each age group"
      />
    </Blade>
    <Blade class="col-md-4">
      <EmptyState
        v-if="!currentGroupHasDraws || !currentGroupDances.length || !currentGroupDancers.length"
        :icon="mdiViewSplitVertical"
        label="Championship draws"
        description="Specify dancer order for each dance (optional)"
      />
      <div v-else class="app-scroll app-scroll-frame">
        <HotTable :settings="hotSettings" />
      </div>
      <v-toolbar v-if="currentGroup" class="flex-none">
        <v-list-item v-if="!currentGroupDances.length" class="empty">
          <v-list-item-avatar>
            <v-icon>{{ mdiAlert }}</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              No dances toggled.
            </v-list-item-title>
            <v-list-item-subtitle>
              Enable some first.
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>

        <v-list-item v-else-if="!currentGroupDancers.length" class="empty">
          <v-list-item-avatar>
            <v-icon>{{ mdiAlert }}</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>No dancers in this age group.</v-list-item-title>
            <v-list-item-subtitle>
              <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'dancers' } }">
                Add or import some first &rsaquo;
              </router-link>
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>

        <template v-else>
          <v-switch v-model="currentGroupHasDraws" label="Enable" hide-details />
          <v-btn text color="primary" @click="handleShuffleCurrentGroupDraws()" class="ml-auto">
            Auto-Fill
          </v-btn>
        </template>
      </v-toolbar>
    </Blade>
  </Blades>
</template>

<script>
import {
  mapState,
  mapMutations,
} from 'vuex';
import {
  mdiAlert,
  mdiChevronRight,
  mdiSourcePull,
  mdiViewSplitVertical,
} from '@mdi/js';
import { HotTable, licenseHot } from '@/helpers/admin';
import { findByIdKey } from '@/helpers/competition';
import {
  findGroupDances,
  findGroupDancers,
} from '@/helpers/results';
import { idKey } from '@/helpers/firebase';

export default {
  name: 'CompetitionAdminDanceGroups',
  reactiveInject: {
    competitionBundle: [
      'groups',
      'dances',
      'dancers',
      'draws',
    ],
  },
  props: {
    groupId: String,
    danceId: String,
  },
  data() {
    return {
      idKey,
      mdiAlert,
      mdiChevronRight,
      mdiSourcePull,
      mdiViewSplitVertical,

      currentGroupDrawsEnabled: undefined,
    };
  },
  computed: {
    ...mapState([
      'clipboard',
    ]),

    currentGroup() {
      if (this.groupId) {
        return findByIdKey(this.groups, this.groupId);
      }
      return null;
    },
    currentGroupDances() {
      if (this.currentGroup) {
        return findGroupDances(this.currentGroup, this.dances);
      }
      return false;
    },
    currentGroupDancers() {
      if (this.currentGroup) {
        return findGroupDancers(this.currentGroup, this.dancers);
      }
      return false;
    },
    currentGroupHasDraws: {
      get() {
        return this.currentGroupDrawsEnabled;
      },
      set(v) {
        this.currentGroupDrawsEnabled = !!v;

        if (!v) {
          // clear if/when disabled
          this.handleResetCurrentGroupDraws();
        }
      },
    },

    hotSettings() {
      const data = this.currentGroupDancers.map(() => ({}));
      const columns = this.currentGroupDances.map((dance) => {
        const danceId = dance[idKey];
        data.forEach((row, index) => {
          if (this.draws?.[this.groupId]?.[danceId]) {
            row[danceId] = this.draws[this.groupId][danceId][index]; // eslint-disable-line no-param-reassign
          }
        });
        return {
          title: dance.$shortName,
          data: danceId,
        };
      });

      return licenseHot({
        colHeaders: true,
        rowHeaders: true,
        stretchH: 'all',

        columns,
        data,

        beforeChange: (changes, source) => {
          if (source !== 'loadData') {
            changes.forEach(([index, danceId, , dancerNumber]) => {
              this.$emit('change', {
                [`draws/${this.groupId}/${danceId}/${index}`]: dancerNumber,
              });
            });
            return false;
          }
          return true;
        },
      });
    },
  },
  watch: {
    currentGroup: {
      async handler(currentGroup) {
        this.currentGroupDrawsEnabled = this.draws && this.draws[this.groupId];

        // scroll to blade, if necessary
        await this.$nextTick();
        const id = currentGroup ? 'dances' : 'groups';
        const element = document.getElementById(`blade-${id}`);
        this.$scrollTo(element, { container: this.$el });
      },
      immediate: true,
    },
  },
  methods: {
    ...mapMutations([
      'copy',
    ]),

    isActive(group) {
      return group[idKey] === this.groupId;
    },

    handleDanceToggle(dance, toggled) {
      this.$emit('change', {
        [`dances/${dance[idKey]}/groupIds/${this.groupId}`]: toggled || null,
      });
    },
    handleCopy() {
      this.copy({
        data: this.currentGroupDances.map((d) => d[idKey]),
        type: 'dance-groups',
      });
    },
    handlePaste() {
      if (!this.clipboard.type === 'dance-groups') return; // ensure proper data type

      (this.clipboard.data || []).forEach((toggledDanceId) => {
        const dance = findByIdKey(this.dances, toggledDanceId);
        if (dance) {
          this.handleDanceToggle(dance, true);
        }
      });
    },

    handleResetCurrentGroupDraws() {
      this.$emit('change', {
        [`draws/${this.groupId}`]: null,
      });
    },
    handleShuffleCurrentGroupDraws() {
      if (this.currentGroupDances && this.currentGroupDancers) {
        const shuffle = (a) => {
          const b = [...a];
          for (let i = b.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [b[i], b[j]] = [b[j], b[i]];
          }
          return b;
        };
        const dancerNumbers = this.currentGroupDancers.map((dancer) => dancer.number);
        const shouldShuffle = (dance) => !/(^| )Reel( |$)/i.test(dance.name); // @TODO: migrate to special cases
        // @TODO: add special case for championships with under 6 people (no draw)
        const draws = this.currentGroupDances.reduce((acc, dance) => ({
          ...acc,
          [dance[idKey]]: shouldShuffle(dance) ? shuffle(dancerNumbers) : dancerNumbers,
        }), {});

        this.handleResetCurrentGroupDraws(); // wipe existing data first
        this.$emit('change', {
          [`draws/${this.groupId}`]: draws,
        });

        this.currentGroupDrawsEnabled = true;
      }
    },
  },
  components: {
    HotTable,
  },
};
</script>
