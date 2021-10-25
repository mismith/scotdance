<template>
  <div class="CompetitionInfo app-scroll-frame alt">
    <div
      v-persist-scroll="`/competitions/${competitionId}/info`"
      class="app-scroll-frame app-scroll"
    >
      <section class="pa-4">
        <v-avatar
          v-if="competition.image"
          color="white"
          size="200"
          class="elevation-2 mb-4"
          :class="{ 'ml-3': $vuetify.breakpoint.mdAndUp }"
          :style="{ float: $vuetify.breakpoint.mdAndUp ? 'right' : undefined }"
        >
          <img :src="competition.image" />
        </v-avatar>
        <h1 class="display-1 mb-4">{{ competition.name }}</h1>
        <p v-if="competition.date" class="headline">
          {{ $moment(competition.date).format('dddd, MMMM D, YYYY') }}
        </p>
        <div class="subtitle-1">
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

        <div v-if="competition.registrationURL" class="d-flex align-center flex-wrap mb-4">
          <v-btn
            :href="formatExternalURL(competition.registrationURL)"
            target="_blank"
            color="primary"
            :disabled="$moment().isAfter(competition.registrationEnd)"
            class="mr-4"
          >
            <span class="ext text-truncate">Register</span>
          </v-btn>
          <div style="opacity: 0.66;">
            <div v-if="competition.registrationStart">
              Registration open{{ $moment(competition.registrationStart).isAfter() ? 's' : 'ed'}}
              {{ $moment(competition.registrationStart).format('MMM D, YYYY \\a\\t h:mma') }}
            </div>
            <div v-if="competition.registrationEnd">
              Registration close{{ $moment(competition.registrationEnd).isAfter() ? 's' : 'd'}}
              {{ $moment(competition.registrationEnd).format('MMM D, YYYY \\a\\t h:mma') }}
            </div>
          </div>
        </div>

        <div v-if="competition.links">
          <v-btn
            v-for="link in competition.links"
            :key="link.url"
            :href="formatExternalURL(link.url)"
            target="_blank"
            color="primary"
            class="mr-4 mb-4"
          >
            <span class="ext text-truncate">{{ link.name || formatHumanURL(link.url) }}</span>
          </v-btn>
        </div>

        <div v-if="competition.description" v-html="competition.description" class="mb-4 pre-line" />
        <p v-if="competition.sobhd">
          <small><strong>SOBHD</strong> {{ competition.sobhd }}</small>
        </p>
      </section>

      <v-list v-if="staff.length" expand class="staff grouped">
        <v-list-group
          v-for="(group, name) in groupedStaff"
          :key="name"
          :value="isGroupExpanded(name, Object.keys(groupedStaff))"
          @click="handleGroupExpanded(name)"
        >
          <template #activator>
            <v-subheader>{{ name }}s</v-subheader>
          </template>

          <v-list two-line :class="{ 'long-list': group.length > 12 }">
            <DancerListItem
              v-for="member of group"
              :key="member[idKey]"
              :dancer="member"
              @click="setCurrentDialog(['staff', member])"
            >
              <template #favorite><span /></template>
              <template #avatar>
                <v-list-item-avatar v-if="member.image" color="white">
                  <img :src="member.image" />
                </v-list-item-avatar>
                <span v-else />
              </template>
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
  formatExternalURL,
  formatHumanURL,
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
      return groupBy(this.staff.filter((member) => member.type), 'type');
    },
  },
  methods: {
    formatExternalURL,
    formatHumanURL,
    ...mapMutations([
      'setCurrentDialog',
    ]),

    isGroupExpanded(groupName, groupNames) {
      return isExpanded(this.infoExpandedGroups, groupName, groupNames, true);
    },
    handleGroupExpanded(groupName, expanded = undefined) {
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
.v-btn {
  max-width: 100%;

  .v-btn__content {
    width: 100%;
  }
}
</style>
