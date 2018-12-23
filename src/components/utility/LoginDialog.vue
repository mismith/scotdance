<template>
  <md-dialog
    :md-active.sync="loginVisible"
    :md-fullscreen="false"
    @md-closed="forgot = false"
    class="login-dialog"
  >
    <form v-if="!forgot" @submit.prevent="login()">
      <div class="md-dialog-content">
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

        <aside v-if="authError" class="validation-message">
          {{ authError.message }}
        </aside>
      </div>

      <footer class="md-dialog-actions">
        <v-btn @click="loginVisible = false">Cancel</v-btn>

        <v-btn type="submit" color="primary" :loading="authLoading">Login</v-btn>
      </footer>
    </form>
    <form v-else @submit.prevent="reset()">
      <div class="md-dialog-content">
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

        <aside v-if="authError" class="validation-message">
          {{ authError.message }}
        </aside>
        <aside v-if="authMessage" class="validation-message">
          {{ authMessage }}
        </aside>
      </div>

      <footer class="md-dialog-actions">
        <v-btn @click="forgot = false; authError = null;">Back</v-btn>

        <v-btn type="submit" color="primary" :loading="authLoading">Send</v-btn>
      </footer>
    </form>
  </md-dialog>
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
