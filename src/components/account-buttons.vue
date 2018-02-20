<template>
  <div class="account-buttons">
    <md-button
      @click="registerVisible = true"
      class="md-raised"
    >
      <span>Register</span>
    </md-button>
    <md-button
      @click="loginVisible = true"
      class="md-raised"
    >
      <span>Login</span>
    </md-button>

    <md-dialog :md-active.sync="registerVisible" :md-fullscreen="false" class="register-dialog">
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

          <aside v-if="authError" class="validation-message">
            {{ authError.message }}
          </aside>
        </div>

        <footer class="md-dialog-actions">
          <md-spinnable :md-spinning="authLoading">
            <md-button type="submit" class="md-primary md-raised">Register</md-button>
          </md-spinnable>
        </footer>
      </form>
    </md-dialog>
    <md-dialog :md-active.sync="loginVisible" :md-fullscreen="false" class="login-dialog">
      <swiper ref="loginSwiper" :options="{ slidesPerView: 'auto' }" class="swiper-no-swiping">
        <swiper-slide>
          <form @submit.prevent="login(credentials).then(() => (loginVisible = false))">
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

              <aside v-if="authError" class="validation-message">
                {{ authError.message }}
              </aside>
            </div>

            <footer class="md-dialog-actions">
              <md-spinnable :md-spinning="authLoading">
                <md-button type="submit" class="md-primary md-raised">Login</md-button>
              </md-spinnable>

              <md-button @click="$refs.loginSwiper.swiper.slideNext(); authError = null;">
                Forgot?
              </md-button>
            </footer>
          </form>
        </swiper-slide>
        <swiper-slide>
          <form @submit.prevent="forgot(credentials).then(handlePasswordReset)">
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
              <md-spinnable :md-spinning="authLoading">
                <md-button type="submit" class="md-primary md-raised">Send</md-button>
              </md-spinnable>

              <md-button @click="$refs.loginSwiper.swiper.slidePrev(); authError = null;">Cancel</md-button>
            </footer>
          </form>
        </swiper-slide>
      </swiper>
    </md-dialog>
  </div>
</template>

<script>
import {
  firebase,
  db,
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

    handlePasswordReset() {
      this.authMessage = 'Success! Check your email inbox for instructions to reset your password.';
    },
  },
};
</script>

<style lang="scss">
.account-buttons {
  display: flex;
  flex-direction: column;
}
.login-dialog {
  .md-dialog-container,
  .swiper-container {
    width: 100%;
  }
}
</style>
