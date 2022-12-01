<template>
  <div class="PaginatedList app-scroll-frame">
    <div class="app-scroll-frame app-scroll">
      <v-list v-if="items.length">
        <slot v-for="item in paginatedItems" v-bind="item" />
      </v-list>
      <EmptyState
        v-else
        :icon="mdiAlertCircleOutline"
        label="No items match"
      />
    </div>

    <Pagination v-model="page" :pages="pages" />
  </div>
</template>

<script>
import Pagination from './Pagination.vue';

export default {
  name: 'PaginatedList',
  props: {
    items: Array,
  },
  data() {
    return {
      page: 1,
      itemsPerPage: 50,
    };
  },
  computed: {
    pages() {
      const total = Math.ceil(this.items.length / this.itemsPerPage);
      return Array.from(Array(total + 1).keys()).slice(1); // [1...N]
    },
    offset() {
      return (this.page - 1) * this.itemsPerPage;
    },
    paginatedItems() {
      return this.items.slice(this.offset, this.offset + this.itemsPerPage);
    },
  },
  watch: {
    items(items) {
      if (this.offset > items.length) {
        this.page = 1;
      }
    },
  },
  components: {
    Pagination,
  },
};
</script>

<style lang="scss">
.PaginatedList {
  .pagination {
    white-space: nowrap;

    .v-toolbar__content {
      width: 100%;
    }
    .v-select__selections {
      margin-left: 16px;
    }
  }
}
</style>
