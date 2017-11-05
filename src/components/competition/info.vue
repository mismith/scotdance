<template>
  <div class="competition-info md-scroll-frame">
    <div class="md-scroll">
      <h1>{{ competition.name }}</h1>
      <p>{{ competition.location }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'competition-info',
  props: {
    competitionRef: {
      type: Object,
      required: true,
    },
  },
  firebase() {
    return {
      competition: {
        source: this.competitionRef,
        asObject: true,
      },
    };
  },
};
</script>

<style lang="scss">
.competition-info {
  padding: 0 16px;
}
</style>
