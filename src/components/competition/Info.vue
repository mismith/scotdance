<template>
  <div class="competition-info app-scroll-frame alt">
    <div
      v-persist-scroll="`/competitions/${competitionId}/info`"
      class="app-scroll-frame app-scroll"
    >
      <section class="hero">
        <h1 class="display-1">{{ competition.name }}</h1>
        <p v-if="competition.date" class="headline">
          {{ $moment(competition.date).format('dddd, MMMM D, YYYY') }}
        </p>
        <p v-if="competition.venue" class="subheading">
          <a v-if="competition.address" :href="`https://maps.google.com/?q=${competition.venue},+${competition.address}`" target="_blank" class="ext">{{ competition.venue }}</a>
          <span v-else>{{ competition.venue }}</span>
          <br />
          <span>{{ competition.location }}</span>
        </p>
        <p v-if="competition.sobhd">
          <small><strong>SOBHD</strong> {{ competition.sobhd }}</small>
        </p>
        <v-layout v-if="competition.registrationURL">
          <v-btn
            :href="competition.registrationURL"
            target="_blank"
            color="primary"
            class="ml-0"
          >
            <span class="ext">Register</span>
          </v-btn>
          <v-flex style="opacity: 0.66;">
            <div v-if="competition.registrationStart">
              Registration open{{ $moment(competition.registrationStart).isAfter() ? 's' : 'ed'}}
              {{ $moment(competition.registrationStart).format('MMM D, YYYY \\a\\t h:mma') }}
            </div>
            <div v-if="competition.registrationEnd">
              Registration close{{ $moment(competition.registrationEnd).isAfter() ? 's' : 'd'}}
              {{ $moment(competition.registrationEnd).format('MMM D, YYYY \\a\\t h:mma') }}
            </div>
          </v-flex>
        </v-layout>
      </section>

      <v-list v-if="staff.length" expand class="staff grouped">
        <v-list-group
          v-for="(group, name) in groupedStaff"
          :key="name"
          :value="isGroupExpanded(name, Object.keys(groupedStaff))"
          @input="handleGroupExpanded(name, $event)"
        >
          <v-subheader slot="activator">{{ name }}s</v-subheader>

          <v-list two-line :class="{ 'long-list': group.length > 12 }">
            <dancer-list-item
              v-for="member of group"
              :key="member[idKey]"
              :dancer="member"
              @click="setCurrentDialog(['staff', member])"
            >
              <v-list-tile-avatar v-if="member.image" slot="avatar">
                <img :src="member.image" />
              </v-list-tile-avatar>
            </dancer-list-item>
          </v-list>
        </v-list-group>
      </v-list>
    </div>
  </div>
</template>

<script>
import { mapMutations } from 'vuex';
import groupBy from 'lodash.groupby';
import DancerListItem from '@/components/utility/DancerListItem.vue';
import { idKey } from '@/helpers/firebase';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'competition-info',
  props: {
    competitionId: String,
    competition: Object,
    staff: Array,
  },
  localStorage: {
    infoExpandedGroups: {
      type: Object,
      default: {},
    },
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    groupedStaff() {
      return groupBy(this.staff.filter(member => member.type), 'type');
    },
  },
  methods: {
    ...mapMutations([
      'setCurrentDialog',
    ]),

    isGroupExpanded(groupName, groupNames) {
      return isExpanded(this.infoExpandedGroups, groupName, groupNames, true);
    },
    handleGroupExpanded(groupName, expanded) {
      this.infoExpandedGroups = handleExpanded(this.infoExpandedGroups, groupName, expanded);
      this.$localStorage.set('infoExpandedGroups', this.infoExpandedGroups);
    },
  },
  components: {
    DancerListItem,
  },
};
</script>

<style lang="scss">
.competition-info {
  .app-scroll > section {
    padding: 0 16px 16px;
  }
  .staff {
    .dancer-list-item {
      .md-list-item-content {
        min-height: 48px;
      }
      .md-avatar:first-child,
      .favorite-dancer-button {
        display: none;
      }
    }
  }
}
</style>
