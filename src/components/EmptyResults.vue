<template>
  <v-list-item class="EmptyResults empty">
    <v-list-item-avatar>
      <v-icon>{{ hasExplicitlyEmptyResults ? mdiCancel : mdiTimerSand }}</v-icon>
    </v-list-item-avatar>
    <v-list-item-content>
      <template v-if="hasExplicitlyEmptyResults">
        No {{ danceId === callbacks[idKey] ? 'Callbacks' : 'Dancers Placed' }}
      </template>
      <template v-else>
        Results to be determined.
      </template>
    </v-list-item-content>
  </v-list-item>
</template>

<script>
import { mdiCancel, mdiTimerSand } from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import {
  callbacks,
  hasExplicitlyEmptyResults,
} from '@/helpers/results';

export default {
  name: 'EmptyResults',
  props: {
    groupId: String,
    danceId: String,
    results: Object,
  },
  data() {
    return {
      idKey,
      mdiCancel,
      mdiTimerSand,
      callbacks,
    };
  },
  computed: {
    hasExplicitlyEmptyResults() {
      return hasExplicitlyEmptyResults(this.groupId, this.danceId, this.results);
    },
  },
};
</script>
