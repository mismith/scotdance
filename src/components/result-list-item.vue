<template>
  <md-list-item @click="$emit('click', $event)">
    <md-avatar
      class="md-avatar-icon"
      :class="{'md-primary': winner, 'md-accent': winner && winner.$favorite}"
    >
      <span v-if="winner">{{ winner.number }}</span>
      <small v-else>TBD</small>
    </md-avatar>

    <span class="md-list-item-text"><slot /></span>

    <slot name="icon"><md-icon>chevron_right</md-icon></slot>
  </md-list-item>
</template>

<script>
export default {
  name: 'result-list-item',
  props: {
    winner: Object,
  },
};
</script>

<style lang="scss">

</style>
