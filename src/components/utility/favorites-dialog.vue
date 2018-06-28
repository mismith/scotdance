<template>
  <md-dialog
    :md-active.sync="favoritesVisible"
    :md-fullscreen="false"
    class="favorites-dialog"
  >
    <md-dialog-title>
      Track your favourites
      <md-icon class="md-accent">star</md-icon>
    </md-dialog-title>
    <md-dialog-content>
      <p>To see the dancers you care most about <strong>featured throughout the app</strong>, you'll need an account first.</p>
      <p>Fortunately, it takes <strong>less than 30 seconds</strong>—all you need is an email and password.</p>
    </md-dialog-content>
    <div class="md-padding md-bg-primary" style="position: relative;">
      <div class="account-bg" style="background-image: url('static/img/touchicon.png');"></div>
      <account-buttons />
    </div>
    <md-dialog-actions>
      <md-button @click="favoritesVisible = false">Not Now</md-button>
    </md-dialog-actions>
  </md-dialog>
</template>

<script>
import AccountButtons from '@/components/utility/account-buttons';

export default {
  name: 'favorites-dialog',
  computed: {
    favoritesVisible: {
      get() {
        return this.$store.state.currentDialog === 'favorites';
      },
      set(value) {
        return this.$store.commit('setCurrentDialog', value && 'favorites');
      },
    },
  },
  components: {
    AccountButtons,
  },
};
</script>

<style lang="scss">
.favorites-dialog {
  .md-dialog-title {
    display: flex;

    .md-icon {
      margin: 0 4px;
    }
  }
}
</style>
