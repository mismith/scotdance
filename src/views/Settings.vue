<template>
  <form class="Settings app-scroll-frame app-scroll">
    <div class="pa-4">
      <v-subheader>UI</v-subheader>
      <v-list flat>
        <v-list-item-group v-model="darkMode">
          <v-list-item :value="true">
            <template #default="{ active }">
              <v-list-item-avatar>
                <v-icon>mdi-theme-light-dark</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>Dark Mode</v-list-item-title>
              </v-list-item-content>
              <v-list-item-action>
                <v-switch v-model="active" color="primary" readonly />
              </v-list-item-action>
            </template>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </div>
  </form>
</template>

<script>
export default {
  name: 'Settings',
  localStorage: {
    darkMode: {
      type: Boolean,
      default: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    },
  },
  watch: {
    darkMode: {
      handler(darkMode) {
        this.$vuetify.theme.dark = darkMode;
      },
      immediate: true,
    },
  },
};
</script>
