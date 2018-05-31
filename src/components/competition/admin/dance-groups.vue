<template>
  <div class="admin-dance-groups md-scroll-frame">
    <div class="md-layout admin-blades">
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <md-list v-if="groups.length">
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            @click="$router.push({ params: { groupId: group[idKey] } })"
            :class="{ active: isActive(group) }"
          >
            <span class="md-list-item-text">{{ group.$name }}</span>
            <md-icon>chevron_right</md-icon>
          </md-list-item>
        </md-list>
        <md-empty-state
          v-else
          md-icon="error"
          md-label="No age groups found"
        />
      </div>
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
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
          <md-empty-state
            v-else
            md-icon="error"
            md-label="No dances found"
          />
        </md-list>
        <md-empty-state
          v-else
          md-icon="call_merge"
          md-label="Toggle dances"
          md-description="Link age groups to specific dances"
        />
      </div>
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <HotTable v-if="currentGroupDances.length" :settings="hotSettings" class="fullscreen" />
        <md-empty-state
          v-else
          md-icon="sort"
          md-label="Championship draws"
          md-description="Specify dancer order per dance"
        />
      </div>
    </div>
  </div>
</template>

<script>
import HotTable from '@handsontable/vue';
import {
  mapState,
  mapMutations,
} from 'vuex';
import {
  findByIdKey,
} from '@/helpers/competition';
import {
  findGroupDances,
  findGroupDancers,
} from '@/helpers/results';
import {
  idKey,
} from '@/helpers/firebase';

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
        return this.groups.find(group => group[idKey] === this.groupId);
      }
      return null;
    },
    currentGroupDances() {
      if (this.currentGroup) {
        return this.findGroupDances(this.currentGroup);
      }
      return false;
    },

    hotSettings() {
      const data = this.findGroupDancers(this.currentGroup).map(() => ({}));
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

        afterChange: (changes, source) => {
          if (source !== 'loadData') {
            changes.forEach(([index, danceId, , dancerNumber]) => {
              this.$emit('change', {
                [`draws/${this.groupId}/${danceId}/${index}`]: dancerNumber,
              });
            });
          }
        },
      };
    },
  },
  methods: {
    ...mapMutations([
      'copy',
    ]),

    findGroupDances,
    findGroupDancers,

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
