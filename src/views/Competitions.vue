<template>
  <div class="Competitions app-scroll-frame">
    <router-view v-bind="$props" />
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
