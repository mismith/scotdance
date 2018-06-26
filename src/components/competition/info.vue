<template>
  <div class="competition-info md-scroll-frame alt">
    <div v-persist-scroll="$route.fullPath" class="md-scroll-frame md-scroll">
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

          <ul slot="md-expand" class="md-layout" :class="{ 'long-list': group.length > 10 }">
            <li
              v-for="member of group"
              :key="member[idKey]"
              class="md-layout-item"
            >
              <div>{{ member.$name }}</div>
              <small>{{ member.location }}</small>
            </li>
          </ul>
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
import groupBy from 'lodash.groupby';
import {
  idKey,
} from '@/helpers/firebase';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'competition-info',
  props: {
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
      return groupBy(this.staff, 'type');
    },
  },
  methods: {
    isGroupExpanded(groupName, groupNames) {
      return isExpanded(this.infoExpandedGroups, groupName, groupNames, true);
    },
    handleGroupExpanded(groupName, expanded) {
      this.infoExpandedGroups = handleExpanded(this.infoExpandedGroups, groupName, expanded);
      this.$localStorage.set('infoExpandedGroups', this.infoExpandedGroups);
    },
  },
};
</script>

<style lang="scss">
.competition-info {
  > .md-scroll {
    padding: 0 16px;
  }
  .staff {
    .md-list-item-content {
      padding-left: 0;
      padding-right: 0;
    }
    ul {
      background: #fff;
      padding: 0;
      margin: 0;
      list-style: none;

      li {
        padding: 16px;

        > * {
          white-space: nowrap;
        }
      }

      &.long-list {
        display: block;
        padding: 16px;

        li {
          display: block;
          padding: 0;
        }
      }
    }
  }
}
</style>
