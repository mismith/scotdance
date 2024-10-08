<template>
  <DialogCard
    v-model="registerVisible"
    async
    @submit="register"
    content-class="RegisterDialog"
  >
    <v-text-field
      label="Email *"
      type="email"
      name="email"
      v-model="email"
      required
      autofocus
      v-test="'register-dialog:email-field'"
    />
    <v-text-field
      label="New Password *"
      :type="isPasswordVisible ? 'text' : 'password'"
      name="password"
      v-model="password"
      required
      v-test="'register-dialog:password-field'"
      :append-icon="isPasswordVisible ? mdiEyeOff : mdiEye"
      @click:append="isPasswordVisible = !isPasswordVisible"
    />

    <p>
      Already have an account?
      <a @click="$store.commit('setCurrentDialog', 'login')">
        Login
      </a>
    </p>

    <v-alert :value="!!authError" type="error">
      {{ authError && authError.message }}
    </v-alert>

    <template #actions>
      <v-card-actions class="justify-end">
        <v-btn text @click="registerVisible = false">Cancel</v-btn>
        <v-btn text color="primary" :loading="authLoading" type="submit">Register</v-btn>
      </v-card-actions>
    </template>
  </DialogCard>
</template>

<script>
import { mdiEye, mdiEyeOff } from '@mdi/js';
import { mapFields } from 'vuex-map-fields';
import {
  firebase,
  db,
} from '@/helpers/firebase';

export default {
  name: 'RegisterDialog',
  data() {
    return {
      mdiEye,
      mdiEyeOff,

      authLoading: false,
      authError: undefined,
      isPasswordVisible: false,
    };
  },
  computed: {
    ...mapFields([
      'credentials.email',
      'credentials.password',
    ]),

    registerVisible: {
      get() {
        return this.$store.state.currentDialog === 'register';
      },
      set(value) {
        return this.$store.commit('setCurrentDialog', value && 'register');
      },
    },
  },
  watch: {
    registerVisible(v) {
      if (v) {
        this.authError = null;
      }
    },
  },
  methods: {
    register() {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .createUserWithEmailAndPassword(this.email, this.password)
        .then(({ user }) => {
          this.authLoading = false;
          this.email = null;
          this.password = null;

          // add to db
          db.child('users').child(user.uid).set(user.providerData[0]);

          // close dialog
          this.registerVisible = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;

          console.warn(err); // eslint-disable-line no-console
        });
    },
  },
};
</script>
