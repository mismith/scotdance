<template>
  <div class="competition-info md-scroll-frame">
    <div class="md-scroll">
      <section class="hero">
        <h1 class="md-display-1">{{ competition.name }}</h1>
        <p class="md-headline">{{ moment(competition.date).format('dddd, MMMM D, YYYY') }}</p>
        <p v-if="competition.venue" class="md-subheading">
          <a v-if="competition.address" :href="`https://maps.google.com/?q=${competition.address}`" target="_blank" class="ext">{{ competition.venue }}</a>
          <span v-else>{{ competition.venue }}</span>
          <br />
          <span>{{ competition.location }}</span>
        </p>
      </section>

      <section v-if="judges.length" class="staff alt">
        <h3>Judges</h3>
        <ul class="md-layout">
          <li
            v-for="member of judges"
            :key="member[idKey]"
            class="md-layout-item"
          >
            <div>{{ member.$name }}</div>
            <small>{{ member.location }}</small>
          </li>
        </ul>
      </section>

      <section v-if="pipers.length" class="staff alt">
        <h3>Pipers</h3>
        <ul class="md-layout">
          <li
            v-for="member of pipers"
            :key="member[idKey]"
            class="md-layout-item"
          >
            <div>{{ member.$name }}</div>
            <small>{{ member.location }}</small>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script>
import moment from 'moment-mini';
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
  methods: {
    moment,
  },
};
</script>

<style lang="scss">
.competition-info {
  > .md-scroll {
    padding: 0 16px;
  }
  .hero {
    margin-bottom: 32px;
  }
  .staff {
    ul {
      padding: 0;
      marging: 0;
      list-style: none;
    }
  }

  .alt {
    padding: 2px 16px;
    margin-left: -16px;
    margin-right: -16px;
  }
}
</style>
