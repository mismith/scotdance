<template>
  <div class="competition-info md-scroll-frame">
    <div class="md-scroll">
      <h1 class="md-display-3">{{ competition.name }}</h1>
      <p class="md-headline">{{ competition.location }}</p>

      <section v-if="judges.length" class="staff">
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

      <section v-if="pipers.length" class="staff">
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
export default {
  name: 'competition-info',
  props: {
    competition: Object,
    staff: Array,
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
  text-align: center;

  > .md-scroll {
    padding: 0 16px;
  }
  .staff {
    ul {
      padding: 0;
      marging: 0;
      list-style: none;
    }
  }
}
</style>
