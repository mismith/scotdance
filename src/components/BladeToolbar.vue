<template>
  <v-toolbar dense class="BladeToolbar flex-grow-0">
    <v-btn :to="to" exact text icon>
      <v-icon>mdi-chevron-left</v-icon>
    </v-btn>
    <div v-html="text || ($route.meta && $route.meta.title) || 'Back'" class="d-flex text-truncate" />

    <slot />
  </v-toolbar>
</template>

<script>
export default {
  name: 'BladeToolbar',
  props: {
    text: String,
    to: [String, Object],
  },
};
</script>
