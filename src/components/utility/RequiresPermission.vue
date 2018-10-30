<template>
  <div class="requires-permission">
    <template v-if="permission">
      <slot />
    </template>
    <template v-else-if="!$store.state.me">
      <md-empty-state md-icon="block" md-label="Login required" />
    </template>
    <template v-else>
      <md-empty-state md-icon="block" md-label="Access denied" />
    </template>
  </div>
</template>

<script>
export default {
  name: 'requires-permission',
  props: {
    permission: true,
  },
};
</script>

<style lang="scss">
.requires-permission {

}
</style>
