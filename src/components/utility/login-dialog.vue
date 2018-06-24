<template>
  <md-dialog
    :md-active.sync="loginVisible"
    :md-fullscreen="false"
    @md-closed="forgot = false"
    class="login-dialog"
  >
    <form v-if="!forgot" @submit.prevent="login()">
      <div class="md-dialog-content">
        <md-field>
          <label>Email</label>
          <md-input
            type="email"
            name="email"
            v-model="email"
            required
            autofocus
          />
        </md-field>
        <md-field md-has-password>
          <label>Password</label>
          <md-input
            type="password"
            name="password"
            v-model="password"
            required
          />
        </md-field>

        <p>
          Need an account first?
          <a @click="$store.commit('setDialogOpen', 'register')">
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
        <md-button @click="loginVisible = false">Cancel</md-button>

        <md-spinnable :md-spinning="authLoading" md-left>
          <md-button type="submit" class="md-primary md-raised">Login</md-button>
        </md-spinnable>
      </footer>
    </form>
    <form v-else @submit.prevent="reset()">
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
            v-model="email"
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
  mapFields,
} from 'vuex-map-fields';
import {
  firebase,
} from '@/helpers/firebase';

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
        return this.$store.state.dialogOpen === 'login';
      },
      set(value) {
        return this.$store.commit('setDialogOpen', value && 'login');
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

          throw err;
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

          throw err;
        });
    },
  },
};
</script>

<style lang="scss">
.login-dialog {

}
</style>
