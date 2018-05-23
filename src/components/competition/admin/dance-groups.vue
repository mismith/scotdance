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
            {{ group.$name }}
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
          <md-empty-state
            v-if="!dances.length"
            md-icon="error"
            md-label="No dances found"
          />
        </md-list>
        <md-empty-state
          v-else
          md-icon="timeline"
          md-label="Enable dances"
          md-description="Select an age group"
        />
      </div>
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <HotTable v-if="currentGroup" :settings="hotSettings" class="fullscreen" />
      </div>
    </div>
  </div>
</template>

<script>
import HotTable from '@handsontable/vue';
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
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    currentGroup() {
      if (this.groupId) {
        return this.groups.find(group => group[idKey] === this.groupId);
      }
      return null;
    },

    hotSettings() {
      return {
        colHeaders: true,
        rowHeaders: true,
        stretchH: 'all',
        minSpareRows: 1,
        contextMenu: [
          'remove_row',
        ],

        columns: this.findGroupDances(this.currentGroup).map((dance) => {
          return {
            title: dance.$shortName,
          };
        }),
        data: this.findGroupDancers(this.currentGroup),
      };
    },
  },
  methods: {
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
