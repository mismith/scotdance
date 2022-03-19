<template>
  <div class="EmptyState d-flex flex-column align-center justify-center px-3 pt-4 pb-8 ma-auto">
    <v-icon v-if="icon" color="grey" :size="200">{{ icon }}</v-icon>
    <div v-if="label" class="headline my-4">{{ label }}</div>
    <div v-if="description" class="subtitle-1">{{ description }}</div>
    <slot />
  </div>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    icon: String,
    label: String,
    description: String,
  },
};
</script>

<style lang="scss">
.EmptyState {
  text-align: center;
}
</style>
