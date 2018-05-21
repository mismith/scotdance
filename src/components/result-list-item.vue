<template>
  <md-list-item @click="$emit('click', $event)" class="result-list-item">
    <slot name="avatar">
      <md-avatar
        class="md-avatar-icon"
        :class="{ 'md-primary': winner }"
      >
        <md-icon v-if="winner">check</md-icon>
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

export default {
  name: 'result-list-item',
  props: {
    winner: Object, // undefined -> TBD; {...} -> show checkmark;
    place: Number, // undefined -> show chevron
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
