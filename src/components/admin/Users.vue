<template>
  <blades class="admin-users">
    <blade :active="!currentUser" class="xs12 md4">
      <div v-if="users.length" class="app-scroll-frame">
        <v-toolbar>
          <search-field v-model="filterBy" />
        </v-toolbar>

        <paginated-list v-if="loaded" :items="filteredUsers">
          <v-list-tile
            slot-scope="user"
            :to="{ name: $route.name, params: { userId: user[idKey] } }"
            :class="{ active: userId === user[idKey] }"
          >
            <v-list-tile-avatar>
              <gravatar :user="user" />
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{ user.displayName }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ user.uid }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-icon>chevron_right</v-icon>
          </v-list-tile>
        </paginated-list>
        <div v-else class="app-scroll-frame spinner-container">
          <spinner />
        </div>
      </div>
      <empty-state
        v-else
        icon="clear"
        label="No users found"
      />
    </blade>
    <blade :active="currentUser" class="xs12 md8">
      <div v-if="currentUser" class="app-scroll pa-3">
        <dynamic-form
          v-if="section.form"
          :fields="section.form.fields"
          :data="currentUser"
          @change="handleChanges($event, `users/${userId}`)"
        />

        <path-chips
          label="Permissions"
          :data="permissions[currentUser[idKey]]"
          @change="handleChanges($event, `permissions/users/${userId}`)"
        />
        <path-chips
          label="Favourites"
          :data="favorites[currentUser[idKey]]"
          @change="handleChanges($event, `users:favorites/${userId}`)"
        />
      </div>
      <empty-state
        v-else
        icon="touch_app"
        label="See user details"
        description="Select a user"
      />
    </blade>
  </blades>
</template>

<script>
import Fuse from 'fuse.js';
import sortBy from 'lodash.sortby';
import {
  idKey,
  db,
} from '@/helpers/firebase';
import PaginatedList from '@/components/admin/utility/PaginatedList.vue';
import SearchField from '@/components/utility/SearchField.vue';
import DynamicForm from '@/components/admin/utility/DynamicForm.vue';
import PathChips from '@/components/admin/utility/PathChips.vue';

export default {
  name: 'admin-users',
  props: {
    userId: String,
    section: Object,
    users: Array,
    favorites: Object,
    permissions: Object,
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
      const fields = this.section && this.section.form && this.section.form.fields;

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
    PathChips,
  },
};
</script>

<style lang="scss">
.admin-users {

}
</style>
