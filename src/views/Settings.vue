<template>
  <form class="Settings app-scroll-frame app-scroll">
    <div class="pa-4">
      <v-subheader>UI</v-subheader>
      <v-list flat>
        <v-list-item-group v-model="$root.darkMode" v-test="'dark-mode'">
          <v-list-item :value="true">
            <template #default="{ active }">
              <v-list-item-avatar>
                <v-icon>{{ mdiThemeLightDark }}</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>Dark Mode</v-list-item-title>
              </v-list-item-content>
              <v-list-item-action>
                <v-switch :input-value="active" color="primary" aria-label="dark-mode" />
              </v-list-item-action>
            </template>
          </v-list-item>
        </v-list-item-group>
      </v-list>

      <v-subheader>Advanced</v-subheader>
      <v-list>
        <v-list-item @click="confirmResetAppCache = true" v-test="'reset-app-cache'">
          <v-list-item-avatar>
            <v-icon color="error">{{ mdiCached }}</v-icon>
          </v-list-item-avatar>
          <v-list-item-title class="error--text">Reset App Cache</v-list-item-title>
        </v-list-item>
      </v-list>

      <DialogCard
        v-model="confirmResetAppCache"
        title="Reset App Cache"
        cancel-label="No"
        submit-label="Yes"
        @submit="resetAppCache()"
      >
        <p>In order to enhance performance and usability, this app stores certain settings in your device's local and session storage caches.</p>
        <p>If you are ever encountering layout or navigation bugs, clearing these may help resolve certain issues related to:</p>
        <ul class="mb-4">
          <li>expanded/collapsed states</li>
          <li>active/last-used screens</li>
          <li>scroll positions</li>
          <li>recent views</li>
          <li>search queries and/or filters</li>
          <li>competition listings in Browse Competitions</li>
        </ul>
        <p><strong>Are you sure you want to permanently erase these stored settings?</strong></p>
      </DialogCard>
    </div>
  </form>
</template>

<script>
import { mdiCached, mdiThemeLightDark } from '@mdi/js';

export default {
  name: 'Settings',
  data() {
    return {
      mdiCached,
      mdiThemeLightDark,
      confirmResetAppCache: false,
    };
  },
  methods: {
    resetAppCache() {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
      window.location.reload(true);
    },
  },
};
</script>
