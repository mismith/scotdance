<template>
  <div class="requires-permission">
    <template v-if="permission">
      <slot />
    </template>
    <template v-else-if="!$store.state.me">
      <empty-state icon="block" label="Login required" />
    </template>
    <template v-else>
      <empty-state icon="block" label="Access denied" />
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
