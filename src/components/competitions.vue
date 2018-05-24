<template>
  <div class="competitions md-scroll-frame">
    <router-view :competitions="competitions" />
  </div>
</template>

<script>
export default {
  name: 'competitions',
  props: {
    competitions: Array,
  },
};
</script>

<style lang="scss">
.competitions {

}
</style>
