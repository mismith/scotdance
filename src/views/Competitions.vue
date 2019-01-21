<template>
  <div class="Competitions app-scroll-frame">
    <router-view
      :competitions="competitions"
      :competitions-ref="competitionsRef"
      :competitions-data-ref="competitionsDataRef"
    />
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
