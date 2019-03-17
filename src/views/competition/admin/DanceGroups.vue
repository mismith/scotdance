<template>
  <Blades class="AdminDanceGroups" :stacks="true">
    <Blade id="blade-groups" :active="!currentGroup" class="xs12 md4 app-scroll">
      <v-list v-if="groups.length">
        <v-list-tile
          v-for="group in groups"
          :key="group[idKey]"
          :to="{ name: $route.name, params: { groupId: group[idKey] } }"
          :class="{ active: isActive(group) }"
        >
          <v-list-tile-content>
            <v-list-tile-title>{{ group.$name }}</v-list-tile-title>
          </v-list-tile-content>
          <v-icon>chevron_right</v-icon>
        </v-list-tile>
      </v-list>
      <EmptyState
        v-else
        icon="warning"
        label="No age groups found"
      >
        <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'groups' } }">
          <span class="subheading">Add or import some first &rsaquo;</span>
        </router-link>
      </EmptyState>
    </Blade>
    <Blade id="blade-dances" :active="currentGroup" class="xs12 md4 app-scroll">
      <v-list v-if="currentGroup">
        <v-list-tile
          v-for="dance in dances"
          :key="dance[idKey]"
          @click="handleDanceToggle(dance, !dance.groupIds[groupId])"
        >
          <v-list-tile-content>
            <v-list-tile-title>{{ dance.$name }}</v-list-tile-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-switch :input-value="!!dance.groupIds[groupId]" />
          </v-list-tile-action>
        </v-list-tile>

        <footer v-if="dances.length">
          <v-divider />
          <v-btn flat @click="handleCopy">
            Copy
          </v-btn>
          <v-btn flat :disabled="clipboard.type !== 'dance-groups'" @click="handlePaste">
            Paste
          </v-btn>
        </footer>
        <EmptyState
          v-else
          icon="warning"
          label="No dances found"
        >
          <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'dances' } }">
            <span class="subheading">Add or import some first &rsaquo;</span>
          </router-link>
        </EmptyState>
      </v-list>
      <EmptyState
        v-else
        icon="call_merge"
        label="Link dances"
        description="Pick dances for each age group"
      />
    </Blade>
    <Blade class="xs12 md4">
      <EmptyState
        v-if="!currentGroupHasDraws || !currentGroupDances.length || !currentGroupDancers.length"
        icon="vertical_split"
        label="Championship draws"
        description="Specify dancer order for each dance"
      />
      <div v-else class="app-scroll">
        <HotTable :settings="hotSettings" />
      </div>
      <v-toolbar v-if="currentGroup">
        <v-list-tile v-if="!currentGroupDances.length" class="empty">
          <v-list-tile-avatar>
            <v-icon>warning</v-icon>
          </v-list-tile-avatar>
          <v-list-tile-content>
            <v-list-tile-title>
              No dances toggled.
            </v-list-tile-title>
            <v-list-tile-sub-title>
              Enable some first.
            </v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>

        <v-list-tile v-else-if="!currentGroupDancers.length" class="empty">
          <v-list-tile-avatar>
            <v-icon>warning</v-icon>
          </v-list-tile-avatar>
          <v-list-tile-content>
            <v-list-tile-title>No dancers in this age group.</v-list-tile-title>
            <v-list-tile-sub-title>
              <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'dancers' } }">
                Add or import some first &rsaquo;
              </router-link>
            </v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>

        <template v-else>
          <v-switch v-model="currentGroupHasDraws" label="Enable" hide-details />
          <v-btn flat color="primary" @click="handleShuffleCurrentGroupDraws()">
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
import { HotTable } from '@/helpers/admin';
import { findByIdKey } from '@/helpers/competition';
import {
  findGroupDances,
  findGroupDancers,
} from '@/helpers/results';
import { idKey } from '@/helpers/firebase';

export default {
  name: 'admin-dange-groups',
  props: {
    groupId: String,
    danceId: String,

    groups: Array,
    dances: Array,
    dancers: Array,
    draws: Object,
  },
  data() {
    return {
      idKey,

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
          if (this.draws && this.draws[this.groupId] && this.draws[this.groupId][danceId]) {
            row[danceId] = this.draws[this.groupId][danceId][index]; // eslint-disable-line no-param-reassign
          }
        });
        return {
          title: dance.$shortName,
          data: danceId,
        };
      });

      return {
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
      };
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
        data: this.currentGroupDances.map(d => d[idKey]),
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
        const dancerNumbers = this.currentGroupDancers.map(dancer => dancer.number);
        const draws = this.currentGroupDances.reduce((acc, dance) => ({
          ...acc,
          [dance[idKey]]: shuffle(dancerNumbers),
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
