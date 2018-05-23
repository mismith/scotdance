<template>
  <md-list-item @click="$emit('click', $event)" class="result-list-item">
    <slot name="avatar">
      <md-avatar
        class="md-avatar-icon"
        :class="{ 'md-primary': hasResults, 'md-accent': hasFavorites(dancers || []) }"
      >
        <md-icon v-if="hasResults">check</md-icon>
        <small v-else>TBD</small>
      </md-avatar>
    </slot>

    <span class="md-list-item-text"><slot /></span>

    <slot name="icon">
      <place v-if="place !== undefined" :place="place" />
      <md-icon v-else>chevron_right</md-icon>
    </slot>
  </md-list-item>
</template>

<script>
import Place from '@/components/place';
import {
  hasFavorites,
} from '@/helpers/competition';

export default {
  name: 'result-list-item',
  props: {
    dancers: Array, // [] -> TBD; [...] -> show checkmark;
    place: Number, // undefined -> show chevron
  },
  computed: {
    hasResults() {
      return this.dancers && this.dancers.length;
    },
  },
  methods: {
    hasFavorites,
  },
  components: {
    Place,
  },
};
</script>

<style lang="scss">
.result-list-item {

}
</style>
