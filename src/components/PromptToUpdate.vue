<template>
  <DialogCard cancel-label="Later">
    <template #activator="props">
      <slot name="activator" v-bind="props" />
    </template>

    <template #title>
      <v-card-title class="d-flex">
        <div class="title flex">Update Available</div>
        <v-icon>{{ mdiCellphoneArrowDown }}</v-icon>
      </v-card-title>
    </template>
    <template #text>
      <v-card-text class="pa-4 primary white--text" style="position: relative;">
        <div class="account-bg"></div>
        <div style="position: relative; text-align: center;">
          <div>Get the latest version of the app:</div>
          <big>{{ currentVersion }} &rarr; {{ latestVersion }}</big>
        </div>
      </v-card-text>
    </template>
    <template #submit>
      <v-btn
        text
        color="primary"
        :href="platformSpecificAppStoreURL"
        :target="platformSpecificAppStoreURL === '/' ? undefined : '_blank'"
      >
        Update Now
      </v-btn>
    </template>
  </DialogCard>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import { mdiCellphoneArrowDown } from '@mdi/js';

export default {
  name: 'PromptToUpdate',
  data() {
    return {
      mdiCellphoneArrowDown,
    };
  },
  computed: {
    ...mapState([
      'currentVersion',
      'latestVersion',
    ]),
    ...mapGetters([
      'needsUpdating',
    ]),

    platformSpecificAppStoreURL() {
      switch (this.$store.state.$device?.platform?.toLowerCase()) {
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
};
</script>
