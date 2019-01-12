<template>
  <div class="requires-permission">
    <template v-if="permission || $store.state.me">
      <slot />
    </template>
    <template v-else-if="!$store.state.me">
      <slot name="unauthed">
        <empty-state icon="block" label="Login required" class="flex-none mb-0" />
        <account-buttons class="mt-0" />
      </slot>
    </template>
    <template v-else>
      <slot name="unauthorized">
        <empty-state icon="block" label="Access denied" />
      </slot>
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
