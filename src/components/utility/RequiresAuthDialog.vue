<template>
  <DialogCard v-model="dialogVisible" cancel-label="Not Now" class="RequiresAuthDialog">
    <slot slot="title" name="title" />
    <div slot="text">
      <v-card-text>
        <slot />
      </v-card-text>
      <div class="pa-3 primary" style="position: relative;">
        <div class="account-bg"></div>
        <AccountButtons />
      </div>
    </div>
  </DialogCard>
</template>

<script>
import AccountButtons from '@/components/utility/AccountButtons.vue';

export default {
  name: 'RequiresAuthDialog',
  props: {
    name: {
      type: String,
      required: true,
    },
  },
  computed: {
    dialogVisible: {
      get() {
        return this.$store.state.currentDialog === this.name;
      },
      set(value) {
        return this.$store.commit('setCurrentDialog', value && this.name);
      },
    },
  },
  components: {
    AccountButtons,
  },
};
</script>
