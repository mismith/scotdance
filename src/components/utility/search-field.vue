<template>
  <md-field class="search-field">
    <!-- can't use proper <md-input> here because it causes performance issues on mobile devices -->
    <input v-model="filterBy" class="md-input" placeholder="Search" />

    <md-button
      v-if="filterBy !== filterByDebounced"
      class="md-icon-button md-dense"
      disabled
    >
      <mi-md-spinner :diameter="20" :width="6" />
    </md-button>
    <md-button
      v-else-if="filterBy"
      @click="filterByDebounced = ''"
      class="md-icon-button md-dense"
    >
      <md-icon>clear</md-icon>
    </md-button>
    <md-button
      v-else
      class="md-icon-button md-dense"
      disabled
    >
      <md-icon>search</md-icon>
    </md-button>
  </md-field>
</template>

<script>
export default {
  name: 'search-field',
  props: {
    filterBy: String,
  },
  data() {
    return {
      filterByDebounced: this.filterBy,
      filterByTimeout: undefined,
    };
  },
  watch: {
    filterBy(filterBy) {
      clearTimeout(this.filterByTimeout);
      this.filterByTimeout = setTimeout(() => {
        this.filterByDebounced = filterBy;
      }, 300);
    },
    filterByDebounced(filterByDebounced) {
      this.$emit('update:filterBy', filterByDebounced);
    },
  },
};
</script>

<style lang="scss">
.search-field {

}
</style>
