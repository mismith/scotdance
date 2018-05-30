<template>
  <div class="competitions md-scroll-frame">
    <keep-alive>
      <router-view :competitions="competitions" />
    </keep-alive>
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
