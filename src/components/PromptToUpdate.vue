<template>
  <DialogCard cancel-label="Later">
    <slot name="activator" slot="activator" />

    <v-card-title slot="title" class="layout">
      <div class="title flex">Update Available</div>
      <v-icon>system_update</v-icon>
    </v-card-title>
    <v-card-text slot="text" class="pa-4 primary white--text" style="position: relative;">
      <div class="account-bg"></div>
      <div style="position: relative; text-align: center;">
        <div>Get the latest version of the app:</div>
        <big>{{ currentVersion }} &rarr; {{ latestVersion }}</big>
      </div>
    </v-card-text>

    <v-btn
      slot="submit"
      text
      color="primary"
      :href="platformSpecificAppStoreURL"
      target="_blank"
    >
      Update Now
    </v-btn>
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
    platformSpecificAppStoreURL() {
      switch (this.$store.state.$device.platform.toLowerCase()) {
        case 'ios': {
          return 'itms-apps://itunes.apple.com/app/1386475626';
        }
        case 'android': {
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
  },
  created() {
    this.checkForUpdates();
  },
};
</script>
