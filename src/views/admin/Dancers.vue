<template>
  <div class="app-scroll-frame text-center">
    <div class="ma-auto">
      <v-btn :loading="isReindexing" class="mb-3" @click="handleReindex">Re-Index</v-btn>
      <div v-if="dancers.length">{{ dancers.length.toLocaleString() }} dancers in index</div>
      <v-alert :value="Boolean(hasError)" type="error">{{ hasError }}</v-alert>
    </div>
  </div>
</template>

<script>
import { fns } from '@/helpers/firebase';

const reindexDancers = fns.httpsCallable('reindexDancers');

export default {
  name: 'AdminDancers',
  data() {
    return {
      dancers: [],
      isReindexing: false,
      hasError: false,
    };
  },
  methods: {
    async handleReindex() {
      this.hasError = false;
      this.isReindexing = true;
      try {
        const { data: dancers } = await reindexDancers();
        this.$set(this, 'dancers', dancers || []);
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      this.isReindexing = false;
    },
  },
};
</script>
