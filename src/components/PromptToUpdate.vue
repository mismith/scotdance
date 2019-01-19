<template>
  <DialogCard
    cancel-label="Later"
    submit-label="Update Now"
    @submit="updateApp()"
  >
    <slot name="activator" slot="activator" />

    <v-card-title slot="title" class="layout">
      <div class="title flex">Update Available</div>
      <v-icon>system_update</v-icon>
    </v-card-title>
    <v-card-text slot="text" class="pa-3 primary white--text" style="position: relative;">
      <div class="account-bg"></div>
      <div style="position: relative;">
        <div>Get the latest version of the app:</div>
        <big>{{ currentVersion }} &rarr; {{ latestVersion }}</big>
      </div>
    </v-card-text>
  </DialogCard>
</template>

<script>
import { checkForUpdates } from '@/helpers/router';

export default {
  name: 'PromptToUpdate',
  data() {
    return {
      currentVersion: undefined,
      latestVersion: undefined,
    };
  },
  computed: {
    url() {
      switch (this.$store.state.$device.platform) {
        case 'iOS': {
          return 'itms-apps://itunes.apple.com/app/1386475626';
        }
        case 'Android': {
          return 'market://details?id=info.mismith.scotdance';
        }
        default: {
          return '/';
        }
      }
    },
  },
  methods: {
    async checkForUpdates() {
      const updates = await checkForUpdates();
      if (updates) {
        this.currentVersion = updates.currentVersion;
        this.latestVersion = updates.latestVersion;
      }
    },
    updateApp() {
      this.$router.go(this.url);
    },
  },
  created() {
    this.checkForUpdates();
  },
};
</script>
