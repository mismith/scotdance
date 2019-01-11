<template>
  <div class="requires-permission">
    <template v-if="permission || $store.state.me">
      <slot />
    </template>
    <div v-else-if="!$store.state.me" class="ma-auto">
      <empty-state icon="block" label="Login required" />
      <account-buttons />
    </div>
    <template v-else>
      <empty-state icon="block" label="Access denied" />
    </template>
  </div>
</template>

<script>
import AccountButtons from '@/components/utility/AccountButtons.vue';

export default {
  name: 'requires-permission',
  props: {
    permission: true,
  },
  components: {
    AccountButtons,
  },
};
</script>

<style lang="scss">
.requires-permission {

}
</style>
