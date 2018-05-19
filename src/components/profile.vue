<template>
  <div class="profile md-scroll-frame">
    <div class="md-scroll-frame">
      <div v-if="me" class="md-padding md-scroll-frame md-scroll">
        <div class="md-layout md-alignment-center">
          <md-avatar>
            <img
              :src="me.photoURL || `https://avatars.io/gravatar/${me.email}`"
              :alt="me.displayName"
            />
          </md-avatar>
          <div class="md-layout-item md-padding">
            Avatar via <a href="https://gravatar.com/" target="_blank" class="ext">Gravatar</a>
          </div>
        </div>

        <md-field>
          <label>Display name</label>
          <md-input v-model="me.displayName" />
        </md-field>
        <md-field>
          <label>Email</label>
          <md-input v-model="me.email" readonly required />
        </md-field>

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
              <md-spinnable :md-spinning="removeLoading">
                <md-button
                  @click="remove"
                  :disabled="!removeConfirm"
                  class="md-primary md-raised"
                >
                  Delete Account
                </md-button>
              </md-spinnable>
              <md-button @click="removeActive = false">Cancel</md-button>
            </md-dialog-actions>
          </md-dialog>
        </footer>
      </div>
      <md-empty-state
        v-else-if="me !== undefined"
        md-icon="error"
        md-label="Not logged in"
      />
      <md-progress-spinner v-else md-mode="indeterminate" style="margin: auto;" />
    </div>
  </div>
</template>

<script>
import {
  mapState,
} from 'vuex';
import {
  firebase,
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'profile',
  data() {
    return {
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
    removeActive() {
      this.removeConfirm = null;
      this.removeError = null;
    },
  },
  methods: {
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
};
</script>

<style lang="scss">
.profile {
  .md-avatar {
    min-width: 100px;
    min-height: 100px;
    border-radius: 50%;
    margin-bottom: 16px;
  }
}
</style>
