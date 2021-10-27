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

    <v-bottom-navigation v-if="hasPermission" v-model="$root.currentTab">
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
      'faqs',
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
  firebase() {
    return {
      competitionsRaw: db.child('competitions'),
      submissionsRaw: db.child('competitions:submissions'),
      faqsRaw: db.child('faqs'),
      usersRaw: db.child('users'),
      favoritesRaw: {
        source: db.child('users:favorites'),
        asObject: true,
      },
      permissionsRaw: {
        source: db.child('users:permissions'),
        asObject: true,
      },
      versionsRaw: {
        source: db.child('versions'),
        asObject: true,
      },
    };
  },
  computed: {
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
    faqs() {
      return this.faqsRaw;
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
  methods: {
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
