<template>
  <v-toolbar dense class="BladeToolbar">
    <v-btn :to="to" exact flat icon>
      <v-icon>chevron_left</v-icon>
    </v-btn>
    <div v-html="text || ($route.meta && $route.meta.title) || 'Back'" class="flex ellipsis" />

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
