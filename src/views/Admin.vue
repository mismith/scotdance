<template>
  <RequiresPermission :permission="hasPermission" class="Admin app-scroll-frame">
    <v-toolbar dense class="flex-none">
      <v-spacer />

      <v-tooltip left>
        <template #activator="{ on }">
          <v-btn v-on="on" icon text color="primary" :loading="saving">
            <v-icon>{{ mdiCheck }}</v-icon>
          </v-btn>
        </template>
        <span>{{ saving ? 'Saving...' : 'Saved' }}</span>
      </v-tooltip>
    </v-toolbar>

    <div v-if="currentSection" class="app-scroll-frame app-scroll">
      <MiHotTable
        v-if="currentSection.hot"
        :key="currentSection[idKey]"
        :settings="currentSection.hot"
        :data="this[$root.currentTab]"
        @change="handleHotChanges"
      />
      <router-view v-else @change="handleChanges" />
    </div>

    <v-bottom-navigation v-if="hasPermission" :value="$root.currentTab">
      <v-btn
        v-for="section in sections"
        :key="section[idKey]"
        :value="section[idKey]"
        :to="getTabRoute(section[idKey])"
        color="primary"
        text
      >
        <span>{{ section.name }}</span>
        <v-icon :class="section.icon"></v-icon>
      </v-btn>
    </v-bottom-navigation>
  </RequiresPermission>
</template>

<script>
import { mapState } from 'vuex';
import { mdiCheck } from '@mdi/js';
import adminSchema from '@/schemas/admin';
import { idKey, db, toOrderedArray } from '@/helpers/firebase';
import { getFirstExisting } from '@/helpers/router';
import RequiresPermission from '@/components/RequiresPermission.vue';
import MiHotTable from '@/components/admin/MiHotTable.vue';

export default {
  name: 'Admin',
  reactiveProvide: {
    name: 'adminBundle',
    include: [
      'section',
      'competitions',
      'submissions',
      'users',
      'favorites',
      'permissions',
      'versions',
    ],
  },
  data() {
    return {
      idKey,
      mdiCheck,

      saving: false,
      savingPromises: [],
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),

    hasPermission() {
      return this.$store.getters.hasPermission('admin');
    },

    currentSection() {
      return this.getSection(this.$root.currentTab);
    },
    section() { // @TODO: remove
      return this.currentSection;
    },

    sections() {
      return toOrderedArray(adminSchema);
    },
    competitions() {
      return this.competitionsRaw;
    },
    submissions() {
      return this.submissionsRaw;
    },
    users() {
      return this.usersRaw;
    },
    favorites() {
      return this.favoritesRaw;
    },
    permissions() {
      return this.permissionsRaw;
    },
    versions() {
      return {
        current: this.$store.state.currentVersion,
        latest: this.$store.state.latestVersion,
        ...this.versionsRaw,
      };
    },
  },
  watch: {
    me() {
      this.loadFirebase();
    },
  },
  created() {
    this.loadFirebase();
  },
  methods: {
    async loadFirebase() {
      if (this.competitionsRaw) this.$unbind('competitionsRaw');
      this.$bindAsArray('competitionsRaw', db.child('competitions'));

      if (this.submissionsRaw) this.$unbind('submissionsRaw');
      this.$bindAsArray('submissionsRaw', db.child('competitions:submissions'));

      if (this.usersRaw) this.$unbind('usersRaw');
      this.$bindAsArray('usersRaw', db.child('users'));

      if (this.favoritesRaw) this.$unbind('favoritesRaw');
      this.$bindAsObject('favoritesRaw', db.child('users:favorites'));

      if (this.permissionsRaw) this.$unbind('permissionsRaw');
      this.$bindAsObject('permissionsRaw', db.child('users:permissions'));

      if (this.versionsRaw) this.$unbind('versionsRaw');
      this.$bindAsObject('versionsRaw', db.child('versions'));
    },

    getTabRoute(tab) {
      return getFirstExisting({
        name: `admin.${tab}`,
      }, {
        name: 'admin.tab',
        params: {
          tab,
        },
      });
    },
    inTabs(...tabs) {
      return tabs.some((tab) => (this.$root.currentTab) === tab);
    },
    getSection(sectionId) {
      return this.sections.find((section) => section[idKey] === sectionId);
    },

    awaitSave(...promises) {
      return new Promise((resolve, reject) => {
        this.savingPromises.push(...promises);

        if (this.saving) {
          clearTimeout(this.saving);
        }
        this.saving = setTimeout(() => {
          Promise.all(this.savingPromises)
            .then(() => {
              this.saving = false;
              resolve();
            })
            .catch((err) => {
              this.saving = false;
              reject(err);
            });
        }, 1000);
      });
    },
    handleChanges(changes) {
      this.awaitSave(db.update(changes));
    },
    handleHotChanges(changes) {
      Object.entries(changes).forEach(([path, change]) => {
        this.handleChanges({
          [`${this.$root.currentTab}/${path}`]: change,
        });
      });
    },
  },
  components: {
    RequiresPermission,
    MiHotTable,
  },
};
</script>
