<template>
  <div class="paginated-list app-scroll-frame">
    <div class="app-scroll-frame app-scroll">
      <md-list v-if="items.length">
        <slot v-for="item in paginated" v-bind="item" />
      </md-list>
      <div v-else>
        <md-empty-state
          md-icon="error_outline"
          md-label="No items match"
        />
      </div>
    </div>

    <md-toolbar class="pagination md-dense">
      <md-button @click="page -= 1" :disabled="page <= 1" class="md-icon-button">
        <md-icon>skip_previous</md-icon>
      </md-button>
      <div class="info">
        Page
        <md-field>
          <md-select v-model="page">
            <md-option v-for="p in pages" :key="p" :value="p">{{ p }}</md-option>
          </md-select>
        </md-field>
        of {{ pages.length }}
      </div>
      <md-button @click="page += 1" :disabled="page >= pages.length" class="md-icon-button">
        <md-icon>skip_next</md-icon>
      </md-button>
    </md-toolbar>
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

    .info {
      display: flex;
      justify-content: center;
      align-items: center;
      flex: auto;

      .md-field {
        min-height: 0;
        max-width: 60px;
        margin: 0 8px;
        padding: 0;

        .md-input {
          text-align: center;
        }
      }
    }
  }
}
</style>
