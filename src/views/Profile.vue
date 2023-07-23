<template>
  <RequiresPermission class="Profile app-scroll-frame app-scroll">
    <div v-if="me" class="pa-4">
      <header class="d-flex align-center flex-none mb-4">
        <v-avatar :size="100">
          <Gravatar :user="me" />
        </v-avatar>
        <div class="pa-4">
          Avatar via <a href="https://gravatar.com/" target="_blank" class="ext">Gravatar</a>
        </div>
      </header>

      <v-text-field
        label="Display name"
        v-model="me.displayName"
        @input="handleChanges('displayName')"
      />

      <DialogCard
        v-model="emailActive"
        title="Change your email"
        cancel-label="Cancel"
        submit-label="Change Email"
        :disabled="!emailConfirm"
        :loading="emailLoading"
        async
        @submit="updateEmail"
      >
        <template #activator="{ on }">
          <v-text-field
            label="Email *"
            type="email"
            v-model="me.email"
            readonly
            required
            @focus="$event.target.blur(); on.click($event);"
          />
        </template>

        <v-text-field
          label="New Email *"
          v-model="newEmail"
          type="email"
          name="email"
          required
        />
        <v-text-field
          label="Current Password *"
          v-model="emailConfirm"
          :type="isNewEmailPasswordVisible ? 'text' : 'password'"
          name="password"
          required
          :append-icon="isNewEmailPasswordVisible ? mdiEyeOff : mdiEye"
          @click:append="isNewEmailPasswordVisible = !isNewEmailPasswordVisible"
        />
        <v-alert :value="!!emailError" type="error">
          {{ emailError && emailError.message }}
        </v-alert>
      </DialogCard>

      <DialogCard
        v-model="passwordActive"
        title="Change your password"
        cancel-label="Cancel"
        submit-label="Change Password"
        :disabled="!passwordConfirm || !newPassword"
        :loading="passwordLoading"
        async
        @submit="updatePassword"
      >
        <template #activator="{ on }">
          <v-text-field
            label="Password *"
            type="password"
            value="********"
            required
            readonly
            @focus="$event.target.blur(); on.click($event);"
          />
        </template>

        <v-text-field
          label="Current Password *"
          v-model="passwordConfirm"
          :type="isPasswordConfirmVisible ? 'text' : 'password'"
          name="password"
          required
          :append-icon="isPasswordConfirmVisible ? mdiEyeOff : mdiEye"
          @click:append="isPasswordConfirmVisible = !isPasswordConfirmVisible"
        />
        <v-text-field
          label="New Password *"
          v-model="newPassword"
          :type="isNewPasswordVisible ? 'text' : 'password'"
          name="newPassword"
          required
          :append-icon="isNewPasswordVisible ? mdiEyeOff : mdiEye"
          @click:append="isNewPasswordVisible = !isNewPasswordVisible"
        />
        <v-alert :value="!!passwordError" type="error">
          {{ passwordError && passwordError.message }}
        </v-alert>
      </DialogCard>
    </div>

    <v-spacer />
    <footer class="d-flex justify-center flex-none pa-3">
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
        <template #activator="{ on }">
          <v-btn v-on="on" text color="error">Delete Account</v-btn>
        </template>

        <p>This will permanently delete your account and all associated data.</p>
        <p>In order to proceed, please enter your password:</p>
        <v-text-field
          label="Current Password *"
          v-model="removeConfirm"
          :type="isDeleteAccountPasswordVisible ? 'text' : 'password'"
          name="password"
          required
          :append-icon="isDeleteAccountPasswordVisible ? mdiEyeOff : mdiEye"
          @click:append="isDeleteAccountPasswordVisible = !isDeleteAccountPasswordVisible"
        />
        <v-alert :value="!!removeError" type="error">
          {{ removeError && removeError.message }}
        </v-alert>
      </DialogCard>
    </footer>
  </RequiresPermission>
</template>

<script>
import { mapState } from 'vuex';
import { mdiEye, mdiEyeOff } from '@mdi/js';
import {
  firebase,
  idKey,
  db,
} from '@/helpers/firebase';
import RequiresPermission from '@/components/RequiresPermission.vue';

export default {
  name: 'Profile',
  data() {
    return {
      mdiEye,
      mdiEyeOff,

      emailActive: false,
      emailConfirm: undefined,
      newEmail: undefined,
      emailLoading: false,
      emailError: undefined,
      isNewEmailPasswordVisible: false,

      passwordActive: false,
      passwordConfirm: undefined,
      isPasswordConfirmVisible: false,
      newPassword: undefined,
      isNewPasswordVisible: false,
      passwordLoading: false,
      passwordError: undefined,

      isDeleteAccountPasswordVisible: false,
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
    emailActive() {
      this.emailConfirm = null;
      this.newEmail = null;
      this.emailError = null;
    },
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

    async updateEmail() {
      this.emailLoading = true;
      this.emailError = null;
      if (this.me && this.emailConfirm) {
        try {
          const user = firebase.auth().currentUser;
          await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(this.me.email, this.emailConfirm));
          await user.updateEmail(this.newEmail);
          await db.child('users').child(this.me[idKey]).child('email').set(this.newEmail);

          this.emailLoading = false;
          this.emailActive = false;
        } catch (err) {
          this.emailError = err;
          this.emailLoading = false;
        }
      }
    },
    async updatePassword() {
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
          await db.child('users:favorites').child(this.me[idKey]).remove();
          await db.child('users:permissions').child(this.me[idKey]).remove();
          // await db.child('users:tokens').child(this.me[idKey]).remove();
          // await db.child('users:topics').child(this.me[idKey]).remove();

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
    RequiresPermission,
  },
};
</script>
