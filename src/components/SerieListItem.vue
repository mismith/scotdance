<template>
  <v-list-item
    class="SerieListItem"
    :to="to"
  >
    <slot name="action" />
    <v-list-item-content>
      <v-list-item-title>{{ serie.$name }}</v-list-item-title>
    </v-list-item-content>
    <v-icon>mdi-chevron-right</v-icon>
  </v-list-item>
</template>

<script>
export default {
  name: 'SerieListItem',
  props: {
    serie: Object,
    to: Object,
  },
};
</script>
