<template>
  <div class="competition-info md-scroll-frame alt">
    <div
      v-persist-scroll="`/competitions/${competitionId}/info`"
      class="md-scroll-frame md-scroll"
    >
      <section class="hero">
        <h1 class="md-display-1">{{ competition.name }}</h1>
        <p v-if="competition.date" class="md-headline">
          {{ $moment(competition.date).format('dddd, MMMM D, YYYY') }}
        </p>
        <p v-if="competition.venue" class="md-subheading">
          <a v-if="competition.address" :href="`https://maps.google.com/?q=${competition.venue},+${competition.address}`" target="_blank" class="ext">{{ competition.venue }}</a>
          <span v-else>{{ competition.venue }}</span>
          <br />
          <span>{{ competition.location }}</span>
        </p>
      </section>

      <md-list v-if="staff.length" class="staff md-list-cards">
        <md-list-item-cards
          v-for="(group, name) in groupedStaff"
          :key="name"
          md-expand
          :md-expanded="isGroupExpanded(name, Object.keys(groupedStaff))"
          @toggled="handleGroupExpanded(name, $event)"
        >
          <md-subheader>{{ name }}s</md-subheader>

          <md-list slot="md-expand" class="md-double-line md-dense" :class="{ 'long-list': group.length > 12 }">
            <dancer-list-item
              v-for="member of group"
              :key="member[idKey]"
              :dancer="member"
              @click="setCurrentDialog(['staff', member])"
            >
              <md-avatar v-if="member.image" slot="icon">
                <img :src="member.image" />
              </md-avatar>
            </dancer-list-item>
          </md-list>
        </md-list-item-cards>
      </md-list>

      <section>
        <p v-if="competition.sobhd">
          <small><strong>SOBHD</strong> {{ competition.sobhd }}</small>
        </p>
      </section>
    </div>
  </div>
</template>

<script>
import { mapMutations } from 'vuex';
import groupBy from 'lodash.groupby';
import DancerListItem from '@/components/utility/dancer-list-item';
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
  .md-scroll > section {
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
