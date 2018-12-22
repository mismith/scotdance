<template>
  <div class="profile app-scroll-frame">
    <div class="md-padding app-scroll-frame app-scroll">
      <dynamic-field :field="{ type: 'avatar' }" :data="me" />

      <md-field>
        <label>Display name</label>
        <md-input v-model="me.displayName" @input="handleChanges('displayName')" />
      </md-field>
      <md-field>
        <label>Email</label>
        <md-input v-model="me.email" readonly required />
      </md-field>

      <div class="md-layout md-alignment-center">
        <md-button @click="passwordActive = true" class="md-primary">Change Password</md-button>
        <md-dialog :md-active.sync="passwordActive" :md-fullscreen="false" class="change-password-dialog">
          <md-dialog-title>Change your password</md-dialog-title>

          <md-dialog-content>
            <md-field md-toggle-password>
              <label>Current Password</label>
              <md-input
                v-model="passwordConfirm"
                type="password"
                name="password"
                @keypress.enter="changePassword"
              />
            </md-field>
            <md-field md-toggle-password>
              <label>New Password</label>
              <md-input
                v-model="newPassword"
                type="password"
                name="password"
                @keypress.enter="changePassword"
              />
            </md-field>

            <aside v-if="passwordError" class="validation-message">
              {{ passwordError.message }}
            </aside>
          </md-dialog-content>

          <md-dialog-actions>
            <md-button @click="passwordActive = false">Cancel</md-button>

            <md-spinnable :md-spinning="passwordLoading" md-left>
              <md-button
                @click="changePassword"
                :disabled="!passwordConfirm || !newPassword"
                class="md-primary md-raised"
              >
                Change Password
              </md-button>
            </md-spinnable>
          </md-dialog-actions>
        </md-dialog>
      </div>

      <footer class="md-layout md-alignment-center" style="margin-top: auto;">
        <md-button @click="removeActive = true" class="md-accent">Delete Account</md-button>
        <md-dialog :md-active.sync="removeActive" :md-fullscreen="false" class="remove-user-dialog">
          <md-dialog-title>Are you sure?</md-dialog-title>

          <md-dialog-content>
            <p>This will permanently delete your account and all associated data.</p>
            <p>In order to proceed, please enter your password:</p>
            <md-field md-toggle-password>
              <label>Password</label>
              <md-input
                v-model="removeConfirm"
                type="password"
                name="password"
                @keypress.enter="remove"
              />
            </md-field>

            <aside v-if="removeError" class="validation-message">
              {{ removeError.message }}
            </aside>
          </md-dialog-content>

          <md-dialog-actions>
            <md-button @click="removeActive = false">Cancel</md-button>

            <md-spinnable :md-spinning="removeLoading" md-left>
              <md-button
                @click="remove"
                :disabled="!removeConfirm"
                class="md-primary md-raised"
              >
                Delete Account
              </md-button>
            </md-spinnable>
          </md-dialog-actions>
        </md-dialog>
      </footer>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import {
  firebase,
  idKey,
  db,
} from '@/helpers/firebase';
import DynamicField from '@/components/admin/utility/DynamicField.vue';

export default {
  name: 'profile',
  data() {
    return {
      passwordActive: false,
      passwordConfirm: undefined,
      newPassword: undefined,
      passwordLoading: false,
      passwordError: undefined,

      removeActive: false,
      removeConfirm: undefined,
      removeLoading: false,
      removeError: undefined,
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),
  },
  watch: {
    passwordActive() {
      this.passwordConfirm = null;
      this.newPassword = null;
      this.passwordError = null;
    },
    removeActive() {
      this.removeConfirm = null;
      this.removeError = null;
    },
  },
  methods: {
    handleChanges(...props) {
      const changes = {};
      props.forEach((prop) => {
        changes[prop] = this.me[prop] || null;
      });

      db.child('users').child(this.me[idKey]).update(changes);
    },

    async changePassword() {
      this.passwordLoading = true;
      this.passwordError = null;
      if (this.me && this.passwordConfirm && this.newPassword) {
        try {
          const user = firebase.auth().currentUser;
          await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(this.me.email, this.passwordConfirm));
          await user.updatePassword(this.newPassword);

          this.passwordLoading = false;
          this.passwordActive = false;
        } catch (err) {
          this.passwordError = err;
          this.passwordLoading = false;
        }
      }
    },
    async remove() {
      this.removeLoading = true;
      this.removeError = null;
      if (this.me && this.removeConfirm) {
        try {
          const user = firebase.auth().currentUser;
          await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(this.me.email, this.removeConfirm));
          await user.delete();
          await db.child('users').child(this.me[idKey]).remove();
          await db.child('users:favorites ').child(this.me[idKey]).remove();

          this.removeLoading = false;
          this.removeActive = false;
          this.$router.replace('/');
        } catch (err) {
          this.removeError = err;
          this.removeLoading = false;
        }
      }
    },
  },
  components: {
    DynamicField,
  },
};
</script>

<style lang="scss">
.profile {
  .md-avatar {
    min-width: 100px;
    min-height: 100px;
  }
}
</style>
