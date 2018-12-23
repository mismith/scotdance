<template>
  <div class="profile app-scroll-frame">
    <div class="pa-3 app-scroll-frame app-scroll">
      <form>
        <v-layout align-center>
          <v-avatar :size="100">
            <gravatar :user="me" />
          </v-avatar>
          <v-flex class="pa-3">
            Avatar via <a href="https://gravatar.com/" target="_blank" class="ext">Gravatar</a>
          </v-flex>
        </v-layout>

        <v-text-field
          label="Display name"
          v-model="me.displayName"
          @input="handleChanges('displayName')"
        />
        <v-text-field
          label="Email"
          v-model="me.email"
          readonly
          required
        />

        <div>
          <v-btn flat color="primary" @click="passwordActive = true">Change Password</v-btn>
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
              <v-btn @click="passwordActive = false">Cancel</v-btn>

              <v-btn
                color="primary"
                :disabled="!passwordConfirm || !newPassword"
                :loading="passwordLoading"
                @click="changePassword"
              >
                Change Password
              </v-btn>
            </md-dialog-actions>
          </md-dialog>
        </div>

        <footer>
          <v-btn flat color="error" @click="removeActive = true">Delete Account</v-btn>
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
              <v-btn @click="removeActive = false">Cancel</v-btn>

              <v-btn
                flat
                color="error"
                :disabled="!removeConfirm"
                :loading="removeLoading"
                @click="remove"
              >
                Delete Account
              </v-btn>
            </md-dialog-actions>
          </md-dialog>
        </footer>
      </form>
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

}
</style>
