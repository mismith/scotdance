<template>
  <div class="competition-info md-scroll-frame">
    <div class="md-scroll">
      <h1 class="md-display-3">{{ competition.name }}</h1>
      <p class="md-headline">{{ competition.location }}</p>

      <section class="staff">
        <h3>Judges</h3>
        <ul class="md-layout">
          <li v-for="member of staff.filter(staff => staff.type ==='Judge')" class="md-layout-item">
            <div>{{ member.$name }}</div>
            <small>{{ member.location }}</small>
          </li>
        </ul>
      </section>

      <section class="staff">
        <h3>Pipers</h3>
        <ul class="md-layout">
          <li v-for="member of staff.filter(staff => staff.type ==='Piper')" class="md-layout-item">
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
};
</script>

<style lang="scss">
.competition-info {
  text-align: center;
  padding: 0 16px;

  .staff {
    ul {
      padding: 0;
      marging: 0;
      list-style: none;
    }
  }
}
</style>
