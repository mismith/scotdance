<template>
  <div class="RequiresPermission">
    <slot v-if="permission !== undefined ? permission : $store.state.me" />
    <slot name="unauthed" v-else-if="!$store.state.me">
      <EmptyState :icon="mdiBlockHelper" label="Login required" class="flex-none mb-0" key="unauthed" v-test="'requiresPermissionUnauthed'" />
      <AccountButtons class="mt-0" />
    </slot>
    <slot name="unauthorized" v-else>
      <EmptyState :icon="mdiBlockHelper" label="Access denied" key="unauthorized" v-test="'requiresPermissionUnauthorized'" />
    </slot>
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
      default: undefined,
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
