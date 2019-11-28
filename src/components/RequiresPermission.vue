<template>
  <div class="RequiresPermission">
    <template v-if="permission || $store.state.me">
      <slot />
    </template>
    <template v-else-if="!$store.state.me">
      <slot name="unauthed">
        <EmptyState icon="mdi-block-helper" label="Login required" class="flex-none mb-0" />
        <AccountButtons class="mt-0" />
      </slot>
    </template>
    <template v-else>
      <slot name="unauthorized">
        <EmptyState icon="mdi-block-helper" label="Access denied" />
      </slot>
    </template>
  </div>
</template>

<script>
import AccountButtons from '@/components/AccountButtons.vue';

export default {
  name: 'RequiresPermission',
  props: {
    permission: true,
  },
  components: {
    AccountButtons,
  },
};
</script>
