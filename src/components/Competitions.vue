<template>
  <div class="Competitions app-scroll-frame">
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
  name: 'Competitions',
  props: {
    competitions: Array,
    competitionsRef: Object,
    competitionsDataRef: Object,
  },
};
</script>
