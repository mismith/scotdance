<template>
  <div class="admin md-scroll-frame">
    <requires-permission :permission="hasPermission" class="md-scroll-frame">
      <div v-if="currentSection" class="md-scroll-frame">
        <md-toolbar class="md-dense">
          <span style="flex-grow: 1;"></span>

          <md-spunnable :md-spinning="saving" />
        </md-toolbar>
        <div class="md-scroll-frame md-scroll">
          <!-- <dynamic-form
            v-if="currentSection.form"
            :fields="currentSection.form.fields"
            :data="{ test: '@TODO' }"
            class="md-padding"
            @change="handleChanges"
          /> -->
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

    <md-bottom-bar
      ref="bottomBar"
      v-show="hasPermission"
      class="md-accent"
    >
      <md-bottom-bar-item
        v-for="section in sections"
        :key="section[idKey]"
        @click="goToTab(section[idKey])"
        :id="`tab-admin-${section[idKey]}`"
      >
        <md-icon :class="section.icon"></md-icon>
        <span class="md-bottom-bar-label">{{ section.name }}</span>
      </md-bottom-bar-item>
    </md-bottom-bar>
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
import MdSpunnable from '@/components/utility/MdSpunnable.vue';
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
  watch: {
    '$root.currentTab'() { // eslint-disable-line object-shorthand
      this.syncBottomBar();
    },
  },
  methods: {
    async syncBottomBar() {
      await this.$nextTick(); // await md-bottom-bar's internally queued $nextTick
      const adminTabId = `tab-admin-${this.$root.currentTab}`;
      this.$refs.bottomBar.MdBottomBar.activeItem = adminTabId;
    },

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
  mounted() {
    this.syncBottomBar();
  },
  components: {
    RequiresPermission,
    MdSpunnable,
    DynamicForm,
    MiHotTable,
  },
};
</script>

<style lang="scss">
.admin {

}
</style>
