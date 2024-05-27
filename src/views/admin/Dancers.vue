<template>
  <div class="app-scroll-frame text-center">
    <div class="ma-auto d-flex flex-column" style="gap: 2rem;">
      <div class="d-flex flex-column" style="gap: 0.5rem;">
        <v-btn :loading="isReindexingCompetitionsPublished" @click="handleReindexCompetitionsPublished">Re-Index Published Competitions</v-btn>
        <div v-if="Object.keys(compeititonsPublished).length">{{ Object.keys(compeititonsPublished).length.toLocaleString() }} published competitions</div>
      </div>

      <div class="d-flex flex-column" style="gap: 0.5rem;">
        <v-btn :loading="isReindexingTypesense" @click="handleReindexTypesense">Re-Index Typesense</v-btn>
        <div v-if="dancers.length">{{ dancers.length.toLocaleString() }} dancers in index</div>
      </div>

      <v-alert :value="Boolean(hasError)" type="error">{{ hasError }}</v-alert>
    </div>
  </div>
</template>

<script>
import { fns } from '@/helpers/firebase';

const reindexDancers = fns.httpsCallable('reindexDancers');
const reindexCompetitionsPublished = fns.httpsCallable('reindexCompetitionsPublished');

export default {
  name: 'AdminDancers',
  data() {
    return {
      dancers: [],
      isReindexingTypesense: false,
      hasError: false,
      compeititonsPublished: {},
      isReindexingCompetitionsPublished: false,
    };
  },
  methods: {
    async handleReindexTypesense() {
      this.hasError = false;
      this.isReindexingTypesense = true;
      try {
        const { data: dancers } = await reindexDancers();
        this.$set(this, 'dancers', dancers || []);
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      this.isReindexingTypesense = false;
    },
    async handleReindexCompetitionsPublished() {
      this.hasError = false;
      this.isReindexingCompetitionsPublished = true;
      try {
        const { data: compeititonsPublished } = await reindexCompetitionsPublished();
        this.$set(this, 'compeititonsPublished', compeititonsPublished || {});
      } catch (error) {
        this.hasError = error?.message || error;
        console.error(error); // eslint-disable-line no-console
      }
      this.isReindexingCompetitionsPublished = false;
    },
  },
};
</script>
