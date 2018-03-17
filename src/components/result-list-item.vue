<template>
  <md-list-item @click="$emit('click', $event)" class="result-list-item">
    <md-avatar
      class="md-avatar-icon"
      :class="{'md-primary': winner, 'md-accent': winner && winner.$favorite}"
    >
      <span v-if="winner">{{ winner.number }}</span>
      <small v-else>TBD</small>
    </md-avatar>

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
    winner: Object,
    place: Number,
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
