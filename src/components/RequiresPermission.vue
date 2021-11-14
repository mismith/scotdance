<template>
  <div class="RequiresPermission">
    <template v-if="permission || $store.state.me">
      <slot />
    </template>
    <template v-else-if="!$store.state.me">
      <slot name="unauthed">
        <EmptyState :icon="mdiBlockHelper" label="Login required" class="flex-none mb-0" />
        <AccountButtons class="mt-0" />
      </slot>
    </template>
    <template v-else>
      <slot name="unauthorized">
        <EmptyState :icon="mdiBlockHelper" label="Access denied" />
      </slot>
    </template>
  </div>
</template>

<script>
import { mdiBlockHelper } from '@mdi/js';
import AccountButtons from '@/components/AccountButtons.vue';

export default {
  name: 'RequiresPermission',
  props: {
    permission: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      mdiBlockHelper,
    };
  },
  components: {
    AccountButtons,
  },
};
</script>
