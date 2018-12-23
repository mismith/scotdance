<template>
  <v-layout class="search-field">
    <!-- can't use proper <md-input> here because it causes performance issues on mobile devices -->
    <input v-model="filterBy" class="md-input flex" placeholder="Search" />

    <v-btn
      v-if="filterBy !== filterByDebounced"
      icon
      dense
      disabled
    >
      <mi-md-spinner :diameter="20" :width="6" />
    </v-btn>
    <v-btn
      v-else-if="filterBy"
      icon
      dense
      @click="filterByDebounced = ''"
    >
      <v-icon>clear</v-icon>
    </v-btn>
    <v-btn
      v-else
      icon
      dense
      disabled
    >
      <v-icon>search</v-icon>
    </v-btn>
  </v-layout>
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
