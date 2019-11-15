<template>
  <v-layout column align-center justify-center class="EmptyState pb-6 ma-auto">
    <v-icon v-if="icon" color="grey" :size="200">{{ icon }}</v-icon>
    <div v-if="label" class="headline my-4">{{ label }}</div>
    <div v-if="description" class="subtitle-1">{{ description }}</div>
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
