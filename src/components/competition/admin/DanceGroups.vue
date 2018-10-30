<template>
  <blades class="admin-dance-groups" :stacks="true">
    <blade id="blade-groups" :active="!currentGroup" class="md-small-size-100 md-size-33 md-scroll">
      <md-list v-if="groups.length">
        <md-list-item
          v-for="group in groups"
          :key="group[idKey]"
          :to="{ name: $route.name, params: { groupId: group[idKey] } }"
          :class="{ active: isActive(group) }"
        >
          <span class="md-list-item-text">{{ group.$name }}</span>
          <md-icon>chevron_right</md-icon>
        </md-list-item>
      </md-list>
      <div v-else>
        <md-empty-state
          md-icon="clear"
          md-label="No age groups found"
        />
      </div>
    </blade>
    <blade id="blade-dances" :active="currentGroup" class="md-small-size-100 md-size-33 md-scroll">
      <md-list v-if="currentGroup">
        <md-list-item
          v-for="dance in dances"
          :key="dance[idKey]"
        >
          <span class="md-list-item-text">{{ dance.$name }}</span>
          <md-switch
            v-model="dance.groupIds[currentGroup[idKey]]"
            @change="handleDanceToggle(dance, $event)"
          />
        </md-list-item>

        <footer v-if="dances.length">
          <md-divider />
          <md-button
            @click="handleCopy"
          >Copy</md-button>
          <md-button
            :disabled="clipboard.type !== 'dance-groups'"
            @click="handlePaste"
          >Paste</md-button>
        </footer>
        <div v-else>
          <md-empty-state
            md-icon="clear"
            md-label="No dances found"
          />
        </div>
      </md-list>
      <div v-else>
        <md-empty-state
          md-icon="call_merge"
          md-label="Link dances"
          md-description="Pick dances for each age group"
        />
      </div>
    </blade>
    <blade class="md-small-size-100 md-size-33 md-scroll">
      <HotTable v-if="currentGroupDances.length" :settings="hotSettings" class="fullscreen" />
      <div v-else>
        <md-empty-state
          md-icon="vertical_split"
          md-label="Championship draws"
          md-description="Specify dancer order for each dance"
        />
      </div>
    </blade>
  </blades>
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

    hotSettings() {
      const data = findGroupDancers(this.currentGroup, this.dancers).map(() => ({}));
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
  },
  components: {
    HotTable,
  },
};
</script>

<style lang="scss">
.admin-dance-groups {

}
</style>
