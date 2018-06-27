<template>
  <div class="competitions md-scroll-frame">
    <keep-alive>
      <router-view
        :competitions="competitions"
        :competitions-ref="competitionsRef"
        :competitions-data-ref="competitionsDataRef"
      />
    </keep-alive>
  </div>
</template>

<script>
export default {
  name: 'competitions',
  props: {
    competitions: Array,
    competitionsRef: Object,
    competitionsDataRef: Object,
  },
};
</script>

<style lang="scss">
.competitions {

}
</style>
