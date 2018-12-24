<template>
  <dialog-card
    v-model="loginVisible"
    async
    @cancel="forgot = false"
    @submit="forgot ? reset() : login()"
    class="login-dialog"
  >
    <template v-if="!forgot">
      <v-text-field
        label="Email"
        type="email"
        name="email"
        v-model="email"
        required
        autofocus
      />
      <v-text-field
        label="Password"
        type="password"
        name="password"
        v-model="password"
        required
      />

      <p>
        Need an account first?
        <a @click="$store.commit('setCurrentDialog', 'register')">
          Register
        </a>
      </p>
      <p>
        Can't log in?
        <a @click="forgot = true; authError = null;">
          Reset Password
        </a>
      </p>

      <v-alert :value="authError" type="error">
        {{ authError && authError.message }}
      </v-alert>

      <v-card-actions slot="actions" class="justify-end">
        <v-btn flat @click="loginVisible = false">Cancel</v-btn>

        <v-btn flat color="primary" :loading="authLoading" type="submit">Login</v-btn>
      </v-card-actions>
    </template>
    <template v-else>
      <header>
        <p>We can send you a link to reset your password.</p>
        <br />
      </header>

      <v-text-field
        label="Email"
        type="email"
        name="email"
        v-model="email"
        required
        autofocus
      />

      <v-alert :value="authError" type="error">
        {{ authError && authError.message }}
      </v-alert>
      <v-alert :value="authMessage" type="success">
        {{ authMessage }}
      </v-alert>

      <v-card-actions slot="actions" class="justify-end">
        <v-btn flat @click="forgot = false; authError = null;">Back</v-btn>

        <v-btn flat color="primary" :loading="authLoading" type="submit">Send</v-btn>
      </v-card-actions>
    </template>
  </dialog-card>
</template>

<script>
import { mapFields } from 'vuex-map-fields';
import { firebase } from '@/helpers/firebase';

export default {
  name: 'login-dialog',
  data() {
    return {
      authLoading: false,
      authError: undefined,
      authMessage: undefined,

      forgot: false,
    };
  },
  computed: {
    ...mapFields([
      'credentials.email',
      'credentials.password',
    ]),

    loginVisible: {
      get() {
        return this.$store.state.currentDialog === 'login';
      },
      set(value) {
        return this.$store.commit('setCurrentDialog', value && 'login');
      },
    },
  },
  watch: {
    loginVisible(v) {
      if (v) {
        this.authError = null;
      } else {
        this.authMessage = null;
      }
    },
  },
  methods: {
    login() {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .signInWithEmailAndPassword(this.email, this.password)
        .then(() => {
          this.authLoading = false;
          this.email = null;
          this.password = null;

          // close dialog
          this.loginVisible = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;

          console.warn(err); // eslint-disable-line no-console
        });
    },
    reset() {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .sendPasswordResetEmail(this.email)
        .then(() => {
          this.authLoading = false;
          this.email = null;
          this.password = null;

          // alert user
          this.authMessage = 'Success! Check your email inbox for instructions to reset your password.';
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

<style lang="scss">
.login-dialog {

}
</style>
