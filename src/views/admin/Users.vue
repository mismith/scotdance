<template>
  <Blades class="AdminUsers">
    <Blade :active="!currentUser" class="xs12 md4">
      <div v-if="users.length" class="app-scroll-frame">
        <v-toolbar>
          <SearchField v-model="filterBy" />
        </v-toolbar>

        <PaginatedList v-if="loaded" :items="filteredUsers">
          <v-list-tile
            slot-scope="user"
            :to="{ name: $route.name, params: { userId: user[idKey] } }"
            :class="{ active: userId === user[idKey] }"
          >
            <v-list-tile-avatar>
              <Gravatar :user="user" />
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{ user.displayName }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ user.uid }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-icon>chevron_right</v-icon>
          </v-list-tile>
        </PaginatedList>
        <div v-else class="app-scroll-frame">
          <Spinner />
        </div>
      </div>
      <EmptyState
        v-else
        icon="clear"
        label="No users found"
      />
    </Blade>
    <Blade :active="currentUser" class="xs12 md8">
      <BladeToolbar
        :to="{ name: $route.name }"
        class="hidden-md-and-up"
      />

      <div v-if="currentUser" class="app-scroll pa-3">
        <DynamicForm
          :fields="section.fields"
          :data="currentUser"
          @field-change="handleChanges($event, `users/${userId}`)"
        />

        <v-combobox
          label="Permissions"
          v-model="selectedPermissions"
          :items="availablePermissions"
          multiple
          chips
        />
      </div>
      <EmptyState
        v-else
        icon="touch_app"
        label="See user details"
        description="Select a user"
      />
    </Blade>
  </Blades>
</template>

<script>
import Fuse from 'fuse.js';
import sortBy from 'lodash.sortby';
import { flattenPaths } from '@/helpers/admin';
import { idKey, db } from '@/helpers/firebase';
import PaginatedList from '@/components/admin/PaginatedList.vue';
import SearchField from '@/components/SearchField.vue';
import DynamicForm from '@/components/admin/DynamicForm.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';

export default {
  name: 'AdminUsers',
  props: {
    userId: String,
    section: Object,
    users: Array,
    permissions: Object,
    competitions: Array,
  },
  data() {
    return {
      idKey,

      filterBy: undefined,

      loaded: false,
    };
  },
  computed: {
    currentUser() {
      if (this.userId) {
        return this.users.find(user => user[idKey] === this.userId);
      }
      return null;
    },

    filteredUsers() {
      let filtered = this.users;
      const fields = this.section && this.section.fields;

      // filter by search term
      if (this.filterBy && filtered.length && fields) {
        filtered = new Fuse(filtered, {
          keys: fields.map(field => field.data),
          threshold: 0.33,
        }).search(this.filterBy);
      }

      filtered = sortBy(filtered, ['email']);

      return filtered;
    },

    availablePermissions() {
      return [
        {
          text: 'System Administrator',
          value: 'admin',
        },
        ...this.competitions.map(competiton => ({
          text: competiton.name,
          value: `competitons/${competiton[idKey]}`,
        })),
      ];
    },
    selectedPermissions() {
      // @TODO: make this editable
      return flattenPaths(this.permissions[this.currentUser[idKey]])
        .map(path => this.availablePermissions.find(({ value }) => value === path))
        .filter(v => v);
    },
  },
  methods: {
    handleChanges(changes, prefix) {
      Object.entries(changes).forEach(([path, change]) => {
        this.$emit('change', {
          [`${prefix}/${path}`]: change,
        });
      });
    },
  },
  async created() {
    await db.child('users').once('value'); // @TODO: re-use existing ref somehow

    this.loaded = true;
  },
  components: {
    PaginatedList,
    SearchField,
    DynamicForm,
    BladeToolbar,
  },
};
</script>