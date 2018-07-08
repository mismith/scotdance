<template>
  <md-dialog
    :md-active.sync="registerVisible"
    :md-fullscreen="false"
    class="register-dialog"
  >
    <form @submit.prevent="register()">
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
          Already have an account?
          <a @click="$store.commit('setCurrentDialog', 'login')">
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
  mapFields,
} from 'vuex-map-fields';
import {
  firebase,
  db,
} from '@/helpers/firebase';

export default {
  name: 'register-dialog',
  data() {
    return {
      authLoading: false,
      authError: undefined,
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
        .then((me) => {
          this.authLoading = false;
          this.email = null;
          this.password = null;

          // add to db
          db.child('users').child(me.uid).set(me.providerData[0]);

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

<style lang="scss">
.register-dialog {

}
</style>
