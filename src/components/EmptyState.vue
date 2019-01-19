<template>
  <v-layout column align-center justify-center class="EmptyState pb-4 ma-auto">
    <v-icon v-if="icon" color="grey" :size="200">{{ icon }}</v-icon>
    <div v-if="label" class="headline my-3">{{ label }}</div>
    <div v-if="description" class="subheading">{{ description }}</div>
    <slot />
  </v-layout>
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
