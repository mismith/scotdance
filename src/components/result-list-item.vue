<template>
  <md-list-item @click="$emit('click', $event)" class="result-list-item">
    <slot name="avatar">
      <md-avatar
        class="md-avatar-icon"
        :class="{'md-primary': winner, 'md-accent': winner && winner.$favorite}"
      >
        <span v-if="winner && winner.number">{{ winner.number }}</span>
        <md-icon v-else-if="winner">check</md-icon>
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
    winner: Object, // undefined -> TBD; {} -> show checkmark; { number } -> show number
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
