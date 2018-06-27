<template>
  <md-icon v-if="hasResults" class="md-primary summary-icon">
    {{ isInProgress ? 'check_circle_outline' : 'check_circle' }}
  </md-icon>
</template>

<script>
import {
  idKey,
} from '@/helpers/firebase';
import {
  isInProgress,
} from '@/helpers/results';

export default {
  name: 'results-progress-indicator',
  props: {
    category: Object,
    groups: Array,
    dances: Array,
    results: Object,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    hasResults() {
      return this.checkCategoryGroups(this.category, group => this.results[group[idKey]]);
    },
    isInProgress() {
      return this.checkCategoryGroups(this.category, group => !this.results[group[idKey]] || isInProgress(group, this.dances, this.results));
    },
  },
  methods: {
    checkCategoryGroups(category, check = () => {}) {
      return this.groups
        .filter(group => group.categoryId === category[idKey])
        .some(check);
    },
  },
};
</script>

<style lang="scss">
.results-progress-indicator {

}
</style>
