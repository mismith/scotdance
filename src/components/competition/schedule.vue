<template>
  <md-swiper ref="boards" :md-swipeable="!!selected" class="competition-schedule md-scroll-frame">
    <md-board class="md-scroll-frame">
      <md-list class="md-scroll">
        <div v-for="dance in dances" :key="dance[idKey]">
          <md-subheader>{{ dance.name }}</md-subheader>

          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            v-if="dance[group.level]"
            @click="selected = {group, dance}"
          >
            <md-avatar class="md-avatar-icon">
              <span>{{ group.number }}</span>
            </md-avatar>

            <div class="md-list-text-container">
              <span>{{ getGroupName(group) }}</span>
            </div>

            <md-icon>chevron_right</md-icon>
          </md-list-item>
          <md-divider />
        </div>
        <md-spinner md-indeterminate v-if="!loaded" style="margin: auto;" />
      </md-list>
    </md-board>
    <md-board class="md-scroll-frame">
      <md-toolbar class="md-dense">
        <md-button @click="selected = null;" class="md-icon-button">
          <md-icon>chevron_left</md-icon>
        </md-button>
        <span v-if="selected">{{ selected.dance && selected.dance.name }} &rsaquo; {{ getGroupName(selected.group) }}</span>
      </md-toolbar>
      <md-list class="md-double-line md-scroll">
        <dancer-list-item v-for="(dancer, i) in selectedDancers" :key="dancer[idKey]" :dancer="dancer" />
      </md-list>
    </md-board>
  </md-swiper>
</template>

<script>
import DancersGroupsFavoritesMixin from '@/mixins/dancers-groups-favorites';
import DancerListItem from '@/components/dancer-list-item';
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'competition-schedule',
  mixins: [
    DancersGroupsFavoritesMixin,
  ],
  data() {
    return {
      idKey,

      loaded: false,

      selected: undefined,
    };
  },
  firebase: {
    dances: db.child('competitionsData').child('idc0').child('dances'),
    platforms: db.child('competitionsData').child('idc0').child('platforms'),
  },
  computed: {
    selectedDancers() {
      if (this.selected) {
        return this.dancers.filter((dancer) => {
          const group = this.getDancerGroup(dancer);
          return group && group[idKey] === this.selected.group[idKey];
        });
      }
      return [];
    },
  },
  watch: {
    selected(selected) {
      if (selected) {
        this.$refs.boards.next();
      } else {
        this.$refs.boards.prev();
      }
    },
  },
  created() {
    return Promise.all([
      this.$firebaseRefs.dancersRaw.once('value'),
      this.$firebaseRefs.groupsRaw.once('value'),
      this.$firebaseRefs.dances.once('value'),
      this.$firebaseRefs.platforms.once('value'),
    ])
      .then(() => {
        this.loaded = true;
      });
  },
  components: {
    DancerListItem,
  },
};
</script>

<style lang="scss">
.competition-schedule {

}
</style>
