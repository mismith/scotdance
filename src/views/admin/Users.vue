<template>
  <Blades class="AdminUsers">
    <Blade :active="!currentUser" class="col-md-4">
      <div v-if="users.length" class="app-scroll-frame">
        <v-toolbar class="flex-none">
          <SearchField v-model="filterBy" />
        </v-toolbar>

        <PaginatedList v-if="loaded" :items="filteredUsers">
          <v-list-item
            slot-scope="user"
            :to="{ name: $route.name, params: { userId: user[idKey] } }"
            :class="{ active: userId === user[idKey] }"
          >
            <v-list-item-avatar>
              <Gravatar :user="user" />
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ user.displayName }}</v-list-item-title>
              <v-list-item-subtitle>{{ user.uid }}</v-list-item-subtitle>
            </v-list-item-content>
            <v-icon>{{ mdiChevronRight }}</v-icon>
          </v-list-item>
        </PaginatedList>
        <div v-else class="app-scroll-frame">
          <Spinner />
        </div>
      </div>
      <EmptyState
        v-else
        :icon="mdiClose"
        label="No users found"
      />
    </Blade>
    <Blade :active="currentUser" class="col-md-8">
      <BladeToolbar
        :to="{ name: $route.name }"
        class="hidden-md-and-up"
      />

      <div v-if="currentUser" class="app-scroll pa-4">
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
        :icon="mdiGestureTap"
        label="See user details"
        description="Select a user"
      />
    </Blade>
  </Blades>
</template>

<script>
import orderBy from 'lodash.orderby';
import {
  mdiChevronRight,
  mdiClose,
  mdiGestureTap,
} from '@mdi/js';
import { flattenPaths } from '@/helpers/admin';
import { idKey, db } from '@/helpers/firebase';
import { mapRouteParams } from '@/helpers/router';
import { searchByKeys } from '@/helpers/competition';
import PaginatedList from '@/components/admin/PaginatedList.vue';
import SearchField from '@/components/SearchField.vue';
import DynamicForm from '@/components/admin/DynamicForm.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';

export default {
  name: 'AdminUsers',
  reactiveInject: {
    adminBundle: [
      'section',
      'users',
      'permissions',
      'competitions',
    ],
  },
  data() {
    return {
      idKey,
      mdiChevronRight,
      mdiClose,
      mdiGestureTap,

      filterBy: undefined,

      loaded: false,
    };
  },
  computed: {
    ...mapRouteParams([
      'userId',
    ]),

    currentUser() {
      if (this.userId) {
        return this.users.find((user) => user[idKey] === this.userId);
      }
      return null;
    },

    filteredUsers() {
      let filtered = this.users;
      const fields = this.section && this.section.fields;

      // filter by search term
      if (this.filterBy && filtered.length && fields) {
        filtered = searchByKeys(filtered, this.filterBy, fields.map((field) => field.data));
      }

      filtered = orderBy(filtered, ['email']);

      return filtered;
    },

    availablePermissions() {
      return [
        {
          text: 'System Administrator',
          value: 'admin',
        },
        ...this.competitions.map((competiton) => ({
          text: competiton.name,
          value: `competitons/${competiton[idKey]}`,
        })),
      ];
    },
    selectedPermissions() {
      // @TODO: make this editable
      return flattenPaths(this.permissions[this.currentUser[idKey]])
        .map((path) => this.availablePermissions.find(({ value }) => value === path))
        .filter(Boolean);
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
