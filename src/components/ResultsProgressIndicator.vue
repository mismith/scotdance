<template>
  <v-icon v-if="hasResults" color="primary">
    {{ inProgress ? mdiProgressCheck : mdiCheckCircle }}
  </v-icon>
</template>

<script>
import { mdiCheckCircle, mdiProgressCheck } from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import { isGroupInProgress } from '@/helpers/results';

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
      mdiProgressCheck,
    };
  },
  computed: {
    hasResults() {
      return this.checkCategoryGroups(this.category, (group) => this.results[group[idKey]]);
    },
    inProgress() {
      return this.checkCategoryGroups(this.category, (group) => !this.results[group[idKey]] || isGroupInProgress(group, this.dances, this.results));
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
