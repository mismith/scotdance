<template>
  <div class="account-buttons">
    <md-button
      @click="registerVisible = true"
      class="md-raised"
      style="margin-left: auto; margin-right: auto;"
    >
      <span>Register</span>
    </md-button>
    <md-button
      @click="loginVisible = true"
      class="md-raised"
      style="margin-left: auto; margin-right: auto;"
    >
      <span>Login</span>
    </md-button>

    <md-dialog :md-active.sync="registerVisible" :md-fullscreen="false" class="md-dialog-register">
      <form @submit.prevent="register(credentials).then(() => (registerVisible = false))">
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

        <footer>
          <md-spinnable :md-spinning="authLoading">
            <md-button type="submit" class="md-primary md-raised">Register</md-button>
          </md-spinnable>
        </footer>

        <aside v-if="authError">
          {{ authError.message }}
        </aside>
      </form>
    </md-dialog>
    <md-dialog :md-active.sync="loginVisible" :md-fullscreen="false" class="md-dialog-login">
      <swiper ref="loginSwiper" :options="{ slidesPerView: 'auto' }" class="swiper-no-swiping">
        <swiper-slide>
          <form @submit.prevent="login(credentials).then(() => (loginVisible = false))">
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

            <footer>
              <md-spinnable :md-spinning="authLoading">
                <md-button type="submit" class="md-primary md-raised">Login</md-button>
              </md-spinnable>

              <md-button @click="$refs.loginSwiper.swiper.slideNext()">
                Forgot?
              </md-button>
            </footer>

            <aside v-if="authError">
              {{ authError.message }}
            </aside>
          </form>
        </swiper-slide>
        <swiper-slide>
          <form @submit.prevent="forgot(credentials).then(handlePasswordReset)">
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

            <footer>
              <md-spinnable :md-spinning="authLoading">
                <md-button type="submit" class="md-primary md-raised">Send</md-button>
              </md-spinnable>

              <md-button @click="$refs.loginSwiper.swiper.slidePrev()">Cancel</md-button>
            </footer>

            <aside v-if="authMessage">
              {{ authMessage }}
            </aside>
          </form>
        </swiper-slide>
      </swiper>
    </md-dialog>
  </div>
</template>

<script>
import {
  firebase,
} from '@/helpers/firebase';

export default {
  name: 'account-buttons',
  data() {
    return {
      credentials: {
        email: undefined,
        password: undefined,
      },
      authLoading: false,
      authError: undefined,
      authMessage: undefined,

      registerVisible: false,
      loginVisible: false,
    };
  },
  watch: {
    registerVisible(v) {
      if (v) {
        this.authError = null;
      }
    },
    loginVisible(v) {
      if (v) {
        this.authError = null;
      } else {
        this.authMessage = null;
      }
    },
  },
  methods: {
    register(credentials = this.credentials) {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .createUserWithEmailAndPassword(credentials.email, credentials.password)
        .then(() => {
          this.authLoading = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;

          throw err;
        });
    },
    forgot(credentials = this.credentials) {
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

    handlePasswordReset() {
      this.authMessage = 'Success! Check your email inbox for instructions to reset your password.';
    },
  },
};
</script>

<style lang="scss">
.account-buttons {

}
</style>
