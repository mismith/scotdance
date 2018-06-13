<template>
  <div class="competition-info md-scroll-frame alt">
    <div class="md-scroll-frame md-scroll">
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
        <md-list-item-cards v-if="judges.length" md-expand md-expanded>
          <md-subheader>Judges</md-subheader>

          <ul slot="md-expand" class="md-layout">
            <li
              v-for="member of judges"
              :key="member[idKey]"
              class="md-layout-item"
            >
              <div>{{ member.$name }}</div>
              <small>{{ member.location }}</small>
            </li>
          </ul>
        </md-list-item-cards>
        <md-list-item-cards v-if="pipers.length" md-expand md-expanded>
          <md-subheader>Pipers</md-subheader>

          <ul slot="md-expand" class="md-layout">
            <li
              v-for="member of pipers"
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
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'competition-info',
  props: {
    competition: Object,
    staff: Array,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    judges() {
      return this.staff.filter(staff => staff.type === 'Judge');
    },
    pipers() {
      return this.staff.filter(staff => staff.type === 'Piper');
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
    }
  }
}
</style>
