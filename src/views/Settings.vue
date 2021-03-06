<template>
  <form class="Settings app-scroll-frame app-scroll">
    <div class="pa-4">
      <v-subheader>UI</v-subheader>
      <v-list flat>
        <v-list-item-group v-model="$root.darkMode">
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
        <v-list-item @click="confirmClearLocalStorage = true">
          <v-list-item-avatar>
            <v-icon color="error">{{ mdiCached }}</v-icon>
          </v-list-item-avatar>
          <v-list-item-title class="error--text">Reset App Cache</v-list-item-title>
        </v-list-item>
      </v-list>

      <DialogCard
        v-model="confirmClearLocalStorage"
        title="Reset App Cache"
        cancel-label="No"
        submit-label="Yes"
        @submit="clearLocalStorage()"
      >
        <p>In order to enhance performance and usability, this app stores certain settings in your device's local storage cache.</p>
        <p>If you are ever encountering layout or navigation bugs, clearing these may help resolve certain issues related to:</p>
        <ul class="mb-4">
          <li>expanded/collapsed states</li>
          <li>active/last-used screens</li>
          <li>stored scroll positions</li>
          <li>recent views</li>
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
      confirmClearLocalStorage: false,
    };
  },
  methods: {
    clearLocalStorage() {
      if (window.localStorage) {
        window.localStorage.clear();
        window.location.reload();
      }
    },
  },
};
</script>
