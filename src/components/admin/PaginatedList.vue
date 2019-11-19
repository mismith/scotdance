<template>
  <div class="PaginatedList app-scroll-frame">
    <div class="app-scroll-frame app-scroll">
      <v-list v-if="items.length">
        <slot v-for="item in paginated" v-bind="item" />
      </v-list>
      <EmptyState
        v-else
        icon="mdi-error-outline"
        label="No items match"
      />
    </div>

    <v-toolbar v-if="pages.length > 1" dense class="pagination d-flex flex-none">
      <v-btn icon @click="page -= 1" :disabled="page <= 1">
        <v-icon>mdi-skip-previous</v-icon>
      </v-btn>
      <v-row align-center>
        Page
        <v-select v-model="page" :items="pages" single-line hide-details class="mx-2" />
        of {{ pages.length }}
      </v-row>
      <v-btn icon :disabled="page >= pages.length" @click="page += 1">
        <v-icon>mdi-skip-next</v-icon>
      </v-btn>
    </v-toolbar>
  </div>
</template>

<script>
export default {
  name: 'PaginatedList',
  props: {
    items: Array,
  },
  data() {
    return {
      page: 1,
      count: 50,
    };
  },
  computed: {
    pages() {
      const total = Math.ceil(this.items.length / this.count);
      return Array.from(Array(total + 1).keys()).slice(1); // [1...N]
    },
    paginated() {
      const offset = (this.page - 1) * this.count;
      return (this.items || []).slice(offset, offset + this.count);
    },
  },
};
</script>

<style lang="scss">
.PaginatedList {
  .pagination {
    white-space: nowrap;

    .v-text-field {
      padding-top: 0;
    }
  }
}
</style>
