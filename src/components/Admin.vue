<template>
  <div class="admin app-scroll-frame">
    <requires-permission :permission="hasPermission" class="app-scroll-frame">
      <div v-if="currentSection" class="app-scroll-frame">
        <v-toolbar dense>
          <v-spacer />

          <v-btn icon flat color="primary" :loading="saving">
            <v-icon>check</v-icon>
          </v-btn>
        </v-toolbar>
        <div class="app-scroll-frame app-scroll">
          <mi-hot-table
            v-if="currentSection.hot"
            :settings="currentSection.hot"
            :data="this[$root.currentTab]"
            class="fullscreen"
            @change="handleHotChanges"
          />
          <keep-alive v-else>
            <router-view
              v-bind="{
                section: currentSection,
                competitions,
                faqs,
                users,
                favorites,
                permissions,
              }"
              @change="handleChanges"
            />
          </keep-alive>
        </div>
      </div>
    </requires-permission>

    <v-bottom-nav v-if="hasPermission" :value="true" :active="$root.currentTab">
      <v-btn
        v-for="section in sections"
        :key="section[idKey]"
        :value="section[idKey]"
        color="primary"
        flat
        @click="goToTab(section[idKey])"
      >
        <span>{{ section.name }}</span>
        <v-icon :class="section.icon"></v-icon>
      </v-btn>
    </v-bottom-nav>
  </div>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';
import { getFirstExisting } from '@/helpers/router';
import RequiresPermission from '@/components/utility/RequiresPermission.vue';
import MiHotTable from '@/components/admin/utility/MiHotTable.vue';
import DynamicForm from '@/components/admin/utility/DynamicForm.vue';

export default {
  name: 'admin',
  data() {
    return {
      idKey,

      saving: false,
      savingPromises: [],
    };
  },
  firebase() {
    return {
      sectionsRaw: db.child('admin/sections'),
      competitionsRaw: db.child('competitions'),
      faqsRaw: db.child('faqs'),
      usersRaw: db.child('users'),
      favoritesRaw: {
        source: db.child('users:favorites'),
        asObject: true,
      },
      permissionsRaw: {
        source: db.child('permissions/users'),
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

    sections() {
      return this.sectionsRaw;
    },
    competitions() {
      return this.competitionsRaw;
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
  },
  methods: {
    goToTab(tab) {
      const params = {
        competitionId: this.$route.params.competitionId,
      };
      this.$router.push(getFirstExisting({
        name: `admin.${tab}`,
        params,
      }, {
        name: 'admin.tab',
        params: {
          ...params,
          tab,
        },
      }));
    },
    inTabs(...tabs) {
      return tabs.some(tab => (this.$root.currentTab) === tab);
    },
    getSection(sectionId) {
      return this.sections.find(section => section[idKey] === sectionId);
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
    DynamicForm,
    MiHotTable,
  },
};
</script>

<style lang="scss">
.admin {

}
</style>
