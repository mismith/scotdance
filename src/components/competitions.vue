<template>
  <div class="competitions md-scroll-frame">
    <keep-alive v-if="loaded">
      <router-view
        :competitions="competitions"
        :competitions-ref="competitionsRef"
        :competitions-data-ref="competitionsDataRef"
      />
    </keep-alive>
    <div v-else class="md-scroll-frame spinner-container">
      <md-progress-spinner md-mode="indeterminate" />
    </div>
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
  data() {
    return {
      loaded: false,
    };
  },
  async created() {
    await this.competitionsRef.once('value');

    this.loaded = true;
  },
};
</script>

<style lang="scss">
.competitions {

}
</style>
