<template>
  <div class="competition-info md-scroll-frame">
    <div class="md-scroll">
      <h1 class="md-display-3">{{ competition.name }}</h1>
      <p class="md-headline">{{ competition.location }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'competition-info',
  props: {
    competition: Object,
  },
};
</script>

<style lang="scss">
.competition-info {
  text-align: center;
  padding: 0 16px;
}
</style>
