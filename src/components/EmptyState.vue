<template>
  <div class="EmptyState d-flex flex-column align-center justify-center px-3 pt-4 pb-8 ma-auto">
    <v-icon v-if="icon" color="grey" :size="iconSize">{{ icon }}</v-icon>
    <div v-if="label" class="headline my-4">{{ label }}</div>
    <div v-if="description" class="subtitle-1">{{ description }}</div>
    <slot />
  </div>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    icon: {
      type: String,
      required: false,
    },
    iconSize: {
      type: [Number, String],
      default: 200,
    },
    label: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
  },
};
</script>

<style lang="scss">
.EmptyState {
  text-align: center;
}
</style>
