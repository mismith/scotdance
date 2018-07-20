<template>
  <blades class="admin-users">
    <blade :active="!currentUser" class="md-small-size-100 md-size-33">
      <div v-if="users.length" class="md-scroll-frame">
        <md-toolbar>
          <search-field :filter-by.sync="filterBy" />
          <!--<md-menu md-direction="bottom-end" @selected="sortBy">
            <md-button md-menu-trigger class="md-icon-button">
              <md-icon>filter_list</md-icon>
            </md-button>

            <md-menu-content>
              <md-menu-item
                v-for="by in sortableBys"
                :key="by.key"
                @click="sortBy = by.key"
                :class="{ active: sortBy === by.key }"
              >{{ by.name }}</md-menu-item>
            </md-menu-content>
          </md-menu>-->
        </md-toolbar>

        <paginated-list v-if="loaded" :items="filteredUsers">
          <md-list-item
            slot-scope="user"
            :to="{ name: $route.name, params: { userId: user[idKey] } }"
            :class="{ active: userId === user[idKey] }"
          >
            <md-avatar>
              <gravatar :user="user" />
            </md-avatar>
            <div class="md-list-item-text">
              <div>{{ user.displayName }}</div>
              <div>{{ user.uid }}</div>
            </div>
            <md-icon>chevron_right</md-icon>
          </md-list-item>
        </paginated-list>
        <div v-else class="md-scroll-frame spinner-container">
          <mi-md-spinner />
        </div>
      </div>
      <div v-else>
        <md-empty-state
          md-icon="error_outline"
          md-label="No users found"
        />
      </div>
    </blade>
    <blade :active="currentUser" class="md-small-size-100 md-size-66">
      <div v-if="currentUser" class="md-scroll md-padding">
        <dynamic-form
          v-if="section.form"
          :fields="section.form.fields"
          :data="currentUser"
          @change="handleChanges($event, `users/${userId}`)"
        />

        <path-chips
          label="Permissions"
          :data="permissions[currentUser[idKey]]"
          @change="handleChanges($event, `users:permissions/${userId}`)"
        />
        <path-chips
          label="Favourites"
          :data="favorites[currentUser[idKey]]"
          @change="handleChanges($event, `users:favorites/${userId}`)"
        />
      </div>
      <div v-else>
        <md-empty-state
          md-icon="touch_app"
          md-label="See user details"
          md-description="Select a user"
        />
      </div>
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
import PaginatedList from '@/components/admin/utility/paginated-list';
import SearchField from '@/components/utility/search-field';
import DynamicForm from '@/components/admin/utility/dynamic-form';
import PathChips from '@/components/admin/utility/path-chips';

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
