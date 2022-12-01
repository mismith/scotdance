<template>
  <v-toolbar v-if="pages.length > 1" dense class="Pagination flex-none">
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
</template>

<script>
import {
  mdiAlertCircleOutline,
  mdiSkipNext,
  mdiSkipPrevious,
} from '@mdi/js';

export default {
  name: 'Pagination',
  props: {
    value: Number,
    pages: Array,
  },
  data() {
    return {
      mdiAlertCircleOutline,
      mdiSkipNext,
      mdiSkipPrevious,
    };
  },
  computed: {
    page: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
  },
};
</script>

<style lang="scss">
.Pagination {
  white-space: nowrap;

  .v-toolbar__content {
    width: 100%;
  }
  .v-select__selections {
    margin-left: 16px;
  }
}
</style>
