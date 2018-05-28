<template>
  <md-dialog
    :md-active.sync="loginVisible"
    :md-fullscreen="false"
    @md-closed="forgot = false"
    class="login-dialog"
  >
    <form v-if="!forgot" @submit.prevent="login(credentials).then(() => (loginVisible = false))">
      <div class="md-dialog-content">
        <md-field>
          <label>Email</label>
          <md-input
            type="email"
            name="email"
            v-model="credentials.email"
            required
            autofocus
          />
        </md-field>
        <md-field md-has-password>
          <label>Password</label>
          <md-input
            type="password"
            name="password"
            v-model="credentials.password"
            required
          />
        </md-field>

        <a @click="forgot = true; authError = null;">
          Reset Your Password
        </a>

        <aside v-if="authError" class="validation-message">
          {{ authError.message }}
        </aside>
      </div>

      <footer class="md-dialog-actions">
        <md-button @click="loginVisible = false">Cancel</md-button>

        <md-spinnable :md-spinning="authLoading" md-left>
          <md-button type="submit" class="md-primary md-raised">Login</md-button>
        </md-spinnable>
      </footer>
    </form>
    <form v-else @submit.prevent="reset(credentials).then(handlePasswordReset)">
      <div class="md-dialog-content">
        <header>
          <p>We can send you a link to reset your password.</p>
          <br />
        </header>

        <md-field>
          <label>Email</label>
          <md-input
            type="email"
            name="email"
            v-model="credentials.email"
            required
            autofocus
          />
        </md-field>

        <aside v-if="authError" class="validation-message">
          {{ authError.message }}
        </aside>
        <aside v-if="authMessage" class="validation-message">
          {{ authMessage }}
        </aside>
      </div>

      <footer class="md-dialog-actions">
        <md-button @click="forgot = false; authError = null;">Back</md-button>

        <md-spinnable :md-spinning="authLoading" md-left>
          <md-button type="submit" class="md-primary md-raised">Send</md-button>
        </md-spinnable>
      </footer>
    </form>
  </md-dialog>
</template>

<script>
import {
  firebase,
} from '@/helpers/firebase';

export default {
  name: 'login-dialog',
  data() {
    return {
      credentials: {
        email: undefined,
        password: undefined,
      },
      authLoading: false,
      authError: undefined,
      authMessage: undefined,

      forgot: false,
    };
  },
  computed: {
    loginVisible: {
      get() {
        return this.$store.state.loginDialogOpen;
      },
      set(value) {
        return this.$store.commit('setLoginDialogOpen', value);
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
    login(credentials = this.credentials) {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .signInWithEmailAndPassword(credentials.email, credentials.password)
        .then(() => {
          this.authLoading = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;

          throw err;
        });
    },
    reset(credentials = this.credentials) {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .sendPasswordResetEmail(credentials.email)
        .then(() => {
          this.authLoading = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;

          throw err;
        });
    },

    handlePasswordReset() {
      this.authMessage = 'Success! Check your email inbox for instructions to reset your password.';
    },
  },
};
</script>

<style lang="scss">
.login-dialog {

}
</style>
