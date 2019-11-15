<template>
  <form class="Profile app-scroll-frame app-scroll">
    <div class="pa-4">
      <header class="layout align-center flex-none mb-4">
        <v-avatar :size="100">
          <Gravatar :user="me" />
        </v-avatar>
        <div class="flex pa-4">
          Avatar via <a href="https://gravatar.com/" target="_blank" class="ext">Gravatar</a>
        </div>
      </header>

      <v-text-field
        label="Display name"
        v-model="me.displayName"
        @input="handleChanges('displayName')"
      />
      <v-text-field
        label="Email *"
        v-model="me.email"
        readonly
        required
      />

      <DialogCard
        v-model="passwordActive"
        title="Change your password"
        cancel-label="Cancel"
        submit-label="Change Password"
        :disabled="!passwordConfirm || !newPassword"
        :loading="passwordLoading"
        async
        @submit="changePassword"
      >
        <v-btn slot="activator" text color="primary" class="mx-0">Change Password</v-btn>

        <v-text-field
          label="Current Password"
          v-model="passwordConfirm"
          type="password"
          name="password"
        />
        <v-text-field
          label="New Password"
          v-model="newPassword"
          type="password"
          name="password"
        />
        <v-alert :value="passwordError" type="error">
          {{ passwordError && passwordError.message }}
        </v-alert>
      </DialogCard>
    </div>

    <v-spacer />
    <footer class="layout justify-center flex-none">
      <DialogCard
        v-model="removeActive"
        title="Are you sure?"
        cancel-label="Cancel"
        submit-label="Delete Account"
        :disabled="!removeConfirm"
        :loading="removeLoading"
        async
        @submit="remove"
      >
        <v-btn slot="activator" text color="error" class="mx-0">Delete Account</v-btn>

        <p>This will permanently delete your account and all associated data.</p>
        <p>In order to proceed, please enter your password:</p>
        <v-text-field
          label="Password"
          v-model="removeConfirm"
          type="password"
          name="password"
        />
        <v-alert :value="removeError" type="error">
          {{ removeError && removeError.message }}
        </v-alert>
      </DialogCard>
    </footer>
  </form>
</template>

<script>
import { mapState } from 'vuex';
import {
  firebase,
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'Profile',
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
};
</script>
