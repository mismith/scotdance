<template>
  <md-dialog
    :md-active.sync="dialogVisible"
    :md-fullscreen="false"
    class="requires-auth-dialog"
  >
    <md-dialog-title>
      <slot name="title" />
    </md-dialog-title>
    <md-dialog-content>
      <slot />
    </md-dialog-content>
    <div class="pa-3 primary" style="position: relative;">
      <div class="account-bg"></div>
      <account-buttons />
    </div>
    <md-dialog-actions>
      <v-btn @click="dialogVisible = false">Not Now</v-btn>
    </md-dialog-actions>
  </md-dialog>
</template>

<script>
import AccountButtons from '@/components/utility/AccountButtons.vue';

export default {
  name: 'requires-auth-dialog',
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

<style lang="scss">
.requires-auth-dialog {
  .md-dialog-title {
    display: flex;

    .md-icon {
      margin: 0 4px;
    }
  }
}
</style>
