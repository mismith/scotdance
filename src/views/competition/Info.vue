<template>
  <div class="CompetitionInfo app-scroll-frame alt">
    <div
      v-persist-scroll="`/competitions/${competitionId}/info`"
      class="app-scroll-frame app-scroll"
    >
      <section class="pa-3">
        <v-avatar
          v-if="competition.image"
          color="white"
          size="200"
          class="elevation-2 mb-3"
          :class="{ 'ml-3': $vuetify.breakpoint.mdAndUp }"
          :style="{ float: $vuetify.breakpoint.mdAndUp ? 'right' : undefined }"
        >
          <img :src="competition.image" />
        </v-avatar>
        <h1 class="display-1 mb-3">{{ competition.name }}</h1>
        <p v-if="competition.date" class="headline">
          {{ $moment(competition.date).format('dddd, MMMM D, YYYY') }}
        </p>
        <div class="subheading">
          <div v-if="competition.venue">
            <a
              v-if="competition.address"
              :href="`https://maps.google.com/?q=${competition.venue},+${competition.address},+${competition.location}`"
              target="_blank"
              class="ext"
            >
              {{ competition.venue }}
            </a>
            <span v-else>{{ competition.venue }}</span>
          </div>
          <p>{{ competition.location }}</p>
        </div>

        <v-layout v-if="competition.registrationURL" wrap align-center class="mb-3">
          <v-btn
            :href="competition.registrationURL"
            target="_blank"
            color="primary"
            :disabled="$moment().isAfter(competition.registrationEnd)"
            class="ml-0 mr-3"
          >
            <span class="ext">Register</span>
          </v-btn>
          <v-flex xs12 sm6 style="opacity: 0.66;">
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

        <div v-if="competition.links" class="mb-3">
          <v-btn
            v-for="link in competition.links"
            :key="link.url"
            :href="link.url"
            target="_blank"
            color="primary"
            class="ml-0 mr-3"
          >
            <span class="ext">{{ link.name }}</span>
          </v-btn>
        </div>

        <div v-if="competition.description" v-html="competition.description" class="mb-3 pre-line" />
        <p v-if="competition.sobhd">
          <small><strong>SOBHD</strong> {{ competition.sobhd }}</small>
        </p>
      </section>

      <v-list v-if="staff.length" expand class="staff grouped">
        <v-list-group
          v-for="(group, name) in groupedStaff"
          :key="name"
          lazy
          :value="isGroupExpanded(name, Object.keys(groupedStaff))"
          @input="handleGroupExpanded(name, $event)"
        >
          <v-subheader slot="activator">{{ name }}s</v-subheader>

          <v-list two-line :class="{ 'long-list': group.length > 12 }">
            <DancerListItem
              v-for="member of group"
              :key="member[idKey]"
              :dancer="member"
              @click="setCurrentDialog(['staff', member])"
            >
              <span slot="favorite" />
              <v-list-tile-avatar v-if="member.image" slot="avatar">
                <img :src="member.image" />
              </v-list-tile-avatar>
              <span v-else slot="avatar" />
            </DancerListItem>
          </v-list>
        </v-list-group>
      </v-list>
    </div>
  </div>
</template>

<script>
import { mapMutations } from 'vuex';
import groupBy from 'lodash.groupby';
import DancerListItem from '@/components/DancerListItem.vue';
import { idKey } from '@/helpers/firebase';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'CompetitionInfo',
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