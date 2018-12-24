<template>
  <dialog-card
    v-model="dialogVisible"
    cancel-label="Not Now"
    class="requires-auth-dialog"
  >
    <slot slot="title" name="title" />
    <div slot="text">
      <v-card-text>
        <slot />
      </v-card-text>
      <div class="pa-3 primary" style="position: relative;">
        <div class="account-bg"></div>
        <account-buttons />
      </div>
    </div>
  </dialog-card>
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

}
</style>
