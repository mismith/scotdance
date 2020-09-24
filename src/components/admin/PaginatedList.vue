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

    <v-toolbar v-if="pages.length > 1" dense class="pagination flex-none">
      <v-btn icon @click="page -= 1" :disabled="page <= 1">
        <v-icon>{{ mdiSkipPrevious }}</v-icon>
      </v-btn>
      <div class="d-flex flex-nowrap align-center mx-auto">
        Page
        <v-select
          v-model="page"
          :items="pages"
          single-line
          hide-details
          class="mx-2"
          style="max-width: 80px;"
        />
        of {{ pages.length }}
      </div>
      <v-btn icon :disabled="page >= pages.length" @click="page += 1">
        <v-icon>{{ mdiSkipNext }}</v-icon>
      </v-btn>
    </v-toolbar>
  </div>
</template>

<script>
import {
  mdiAlertCircleOutline,
  mdiSkipNext,
  mdiSkipPrevious,
} from '@mdi/js';

export default {
  name: 'PaginatedList',
  props: {
    items: Array,
  },
  data() {
    return {
      mdiAlertCircleOutline,
      mdiSkipNext,
      mdiSkipPrevious,
      page: 1,
      count: 50,
    };
  },
  computed: {
    pages() {
      const total = Math.ceil(this.items.length / this.count);
      return Array.from(Array(total + 1).keys()).slice(1); // [1...N]
    },
    paginatedItems() {
      const offset = this.getOffset();
      return this.items.slice(offset, offset + this.count);
    },
  },
  watch: {
    items(items) {
      if (this.getOffset() > items.length) {
        this.page = 1;
      }
    },
  },
  methods: {
    getOffset() {
      return (this.page - 1) * this.count;
    },
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
