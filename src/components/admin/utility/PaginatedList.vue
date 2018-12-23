<template>
  <div class="paginated-list app-scroll-frame">
    <div class="app-scroll-frame app-scroll">
      <v-list v-if="items.length">
        <slot v-for="item in paginated" v-bind="item" />
      </v-list>
      <div v-else>
        <empty-state
          icon="error_outline"
          label="No items match"
        />
      </div>
    </div>

    <v-toolbar dense class="pagination">
      <v-btn icon @click="page -= 1" :disabled="page <= 1">
        <v-icon>skip_previous</v-icon>
      </v-btn>
      <v-layout>
        Page
        <v-select v-model="page" :items="pages" class="flex" />
        of {{ pages.length }}
      </v-layout>
      <v-btn icon :disabled="page >= pages.length" @click="page += 1">
        <v-icon>skip_next</v-icon>
      </v-btn>
    </v-toolbar>
  </div>
</template>

<script>
export default {
  name: 'paginated-list',
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
.paginated-list {
  .pagination {
    display: flex;
  }
}
</style>
