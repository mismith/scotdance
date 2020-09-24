<template>
  <v-icon v-if="hasResults" color="primary">
    {{ isInProgress ? mdiCheckCircleOutline : mdiCheckCircle }}
  </v-icon>
</template>

<script>
import { mdiCheckCircle, mdiCheckCircleOutline } from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import { isInProgress } from '@/helpers/results';

export default {
  name: 'ResultsProgressIndicator',
  props: {
    category: Object,
    groups: Array,
    dances: Array,
    results: Object,
  },
  data() {
    return {
      idKey,
      mdiCheckCircle,
      mdiCheckCircleOutline,
    };
  },
  computed: {
    hasResults() {
      return this.checkCategoryGroups(this.category, (group) => this.results[group[idKey]]);
    },
    isInProgress() {
      return this.checkCategoryGroups(this.category, (group) => !this.results[group[idKey]] || isInProgress(group, this.dances, this.results));
    },
  },
  methods: {
    checkCategoryGroups(category, check = () => {}) {
      return this.groups
        .filter((group) => group.categoryId === category[idKey])
        .some(check);
    },
  },
};
</script>
