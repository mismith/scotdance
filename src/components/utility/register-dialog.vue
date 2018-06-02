<template>
  <md-dialog
    :md-active.sync="registerVisible"
    :md-fullscreen="false"
    class="register-dialog"
  >
    <form @submit.prevent="register(credentials).then(() => (registerVisible = false))">
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

        <p>
          Already have an account?
          <a @click="$store.commit('setDialogOpen', 'login')">
            Login
          </a>
        </p>

        <aside v-if="authError" class="validation-message">
          {{ authError.message }}
        </aside>
      </div>

      <footer class="md-dialog-actions">
        <md-button @click="registerVisible = false">Cancel</md-button>

        <md-spinnable :md-spinning="authLoading" md-left>
          <md-button type="submit" class="md-primary md-raised">Register</md-button>
        </md-spinnable>
      </footer>
    </form>
  </md-dialog>
</template>

<script>
import {
  firebase,
  db,
} from '@/helpers/firebase';

export default {
  name: 'register-dialog',
  data() {
    return {
      credentials: {
        email: undefined,
        password: undefined,
      },
      authLoading: false,
      authError: undefined,
      authMessage: undefined,
    };
  },
  computed: {
    registerVisible: {
      get() {
        return this.$store.state.dialogOpen === 'register';
      },
      set(value) {
        return this.$store.commit('setDialogOpen', value && 'register');
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
    register(credentials = this.credentials) {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .createUserWithEmailAndPassword(credentials.email, credentials.password)
        .then((me) => {
          this.authLoading = false;

          // add to db
          db.child('users').child(me.uid).set(me.providerData[0]);
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
.register-dialog {

}
</style>
