<template>
  <md-dialog
    :md-active.sync="registerVisible"
    :md-fullscreen="false"
    class="register-dialog"
  >
    <form @submit.prevent="register()">
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
        <v-btn @click="registerVisible = false">Cancel</v-btn>

        <v-btn type="submit" color="primary" :loading="authLoading">Register</v-btn>
      </footer>
    </form>
  </md-dialog>
</template>

<script>
import { mapFields } from 'vuex-map-fields';
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
