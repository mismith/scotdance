<template>
  <DialogCard
    v-model="registerVisible"
    async
    @submit="register"
    class="RegisterDialog"
  >
    <v-text-field
      label="Email *"
      type="email"
      name="email"
      v-model="email"
      required
      autofocus
    />
    <v-text-field
      label="Password *"
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

    <v-alert :value="authError" type="error">
      {{ authError && authError.message }}
    </v-alert>

    <v-card-actions slot="actions" class="justify-end">
      <v-btn flat @click="registerVisible = false">Cancel</v-btn>
      <v-btn flat color="primary" :loading="authLoading" type="submit">Register</v-btn>
    </v-card-actions>
  </DialogCard>
</template>

<script>
import { mapFields } from 'vuex-map-fields';
import {
  firebase,
  db,
} from '@/helpers/firebase';

export default {
  name: 'RegisterDialog',
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