<template>
  <md-swiper ref="boards" :md-swipeable="!!selected" class="competition-schedule md-scroll-frame">
    <md-board>
      <md-tabs md-fixed :md-dynamic-height="false">
        <md-tab md-label="Morning" style="padding: 0;">
          <div class="md-scroll-frame">
            <md-list class="md-scroll">
              <md-list-item
                v-for="dance in dances"
                :key="dance[idKey]"
                md-expand-multiple
              >
                <md-subheader>
                  {{ dance.name }}
                </md-subheader>
                <md-list-expand>
                  <md-list class="md-double-line">
                    <md-list-item
                      v-for="group in groups"
                      :key="group[idKey]"
                      v-if="dance.levelIds && dance.levelIds[group.levelId]"
                      @click="selected = {group, dance}"
                    >
                      <md-avatar class="md-avatar-icon">
                        <span>{{ getPlatform(dance, group).number }}</span>
                      </md-avatar>

                      <div class="md-list-text-container">
                        <span>{{ getGroupName(group) }}</span>
                        <p>Judge Name</p>
                      </div>

                      <md-icon>chevron_right</md-icon>
                    </md-list-item>
                  </md-list>
                </md-list-expand>
              </md-list-item>
              <md-spinner md-indeterminate v-if="!loaded" style="margin: auto;" />
            </md-list>
          </div>
        </md-tab>
        <md-tab md-label="Afternoon">
          TBD
        </md-tab>
      </md-tabs>
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
  firebase() {
    return {
      dances: this.competitionDataRef.child('dances'),
      platforms: this.competitionDataRef.child('platforms'),

      // from DancersGroupsFavoritesMixin
      dancersRaw: this.competitionDataRef.child('dancers'),
      groupsRaw: this.competitionDataRef.child('groups'),
      levels: this.competitionDataRef.child('levels'),
      favorites: this.userFavoritesRef.child('dancers'),
    };
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
  methods: {
    getPlatform() {
      return {
        number: Math.ceil(Math.random() * 3),
      };
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
