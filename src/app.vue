<template>
  <md-app id="app" class="md-scroll-frame md-scroll">
    <md-app-toolbar class="md-primary">
      <md-button class="md-icon-button" @click="menuVisible = !menuVisible">
        <md-icon>menu</md-icon>
      </md-button>

      <h2 class="md-title">{{ 'ScotDance' }}</h2>

      <!--<span class="md-flex"></span>

      <md-button class="md-icon-button">
        <md-icon>search</md-icon>
      </md-button>-->
    </md-app-toolbar>

    <md-app-drawer :md-active.sync="menuVisible">
      <md-toolbar class="md-primary md-large md-account-header">
        <div v-if="!me" class="account-buttons">
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

          <md-dialog :md-active.sync="registerVisible" class="md-dialog-register">
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
          <md-dialog :md-active.sync="loginVisible" class="md-dialog-login">
            <swiper ref="loginSwiper" :options="{width: 280}" class="swiper-no-swiping">
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

                    <md-button
                      @click="$refs.loginSwiper.swiper.slideNext()"
                      class="ml-auto"
                    >
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
        <md-list v-else class="md-transparent">
          <md-list-item>
            <md-avatar class="md-large">
              <img
                :src="me.photoURL || `//avatars.io/gravatar/${me.email}`"
                :alt="me.displayName"
              />
            </md-avatar>
          </md-list-item>
          <md-list-item @click="toggleAccount()" :class="{toggled: accountToggled}">
            <div class="md-list-item-text">
              <span>{{ me.displayName }}</span>
              <span>{{ me.email }}</span>
            </div>
            <md-button class="md-icon-button md-list-action" @click.stop="toggleAccount()">
              <md-icon>arrow_drop_down</md-icon>
            </md-button>
          </md-list-item>
        </md-list>
      </md-toolbar>

      <md-list v-if="accountToggled" class="animate-in">
        <md-subheader>Account</md-subheader>
        <md-list-item @click="logout().then(toggleAccount)">
          <md-icon>exit_to_app</md-icon>
          <span class="md-list-item-text">Logout</span>
        </md-list-item>
      </md-list>
      <md-list v-else>
        <md-subheader>My Competitions</md-subheader>
        <md-list-item
          v-for="competition in competitions"
          :key="competition[idKey]"
          @click="$router.push(`/competitions/${competition[idKey]}`); menuVisible = false;"
        >
          <md-icon>event</md-icon>
          <span class="md-list-item-text">{{ competition.name }}</span>
          <md-button
            v-if="me && me.admin"
            class="md-icon-button md-list-action"
            @click.stop="$router.push(`/competitions/${competition[idKey]}/admin`);
              menuVisible = false;"
          >
            <md-icon>settings</md-icon>
          </md-button>
        </md-list-item>

        <md-list-item
          v-if="me && me.admin"
          @click="$router.push(`/competitions/${db.push().key}/admin`); menuVisible = false;"
        >
          <md-icon>add</md-icon>
          <span class="md-list-item-text">Add new</span>
        </md-list-item>
      </md-list>

      <md-list style="margin-top: auto;">
        <md-subheader>Shortcuts</md-subheader>

        <md-list-item
          @click="$router.push(`/competitions`); menuVisible = false;"
        >
          <md-icon>date_range</md-icon>
          <span class="md-list-item-text">All Competitions</span>
        </md-list-item>
        <md-list-item
          @click="$router.push(`/`); menuVisible = false;"
        >
          <md-icon>home</md-icon>
          <span class="md-list-item-text">Home</span>
        </md-list-item>
      </md-list>
    </md-app-drawer>

    <md-app-content id="main" class="md-scroll-frame md-scroll">
      <router-view :key="$route.fullPath" />
    </md-app-content>

  </md-app>
</template>

<script>
import FirebaseAuthMixin from '@/mixins/firebase/auth';
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'app',
  mixins: [
    FirebaseAuthMixin,
  ],
  data() {
    return {
      idKey,
      db,

      accountToggled: false,
      authMessage: undefined,

      menuVisible: false,

      registerVisible: false,
      loginVisible: false,
    };
  },
  firebase: {
    competitions: db.child('competitions'),
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
    handlePasswordReset() {
      this.authMessage = 'Success! Check your email inbox for instructions to reset your password.';
    },
    toggleAccount(accountToggled = undefined) {
      this.accountToggled = accountToggled !== undefined ? accountToggled : !this.accountToggled;
    },
  },
  created() {
    this.$on('authed', (me) => {
      this.$firebaseRefs.me.update(me.providerData[0]);
    });
  },
};
</script>

<style lang="scss">
// custome vue-material theme
@import "~vue-material/dist/theme/engine";
@include md-register-theme("default", (
  primary: md-get-palette-color(blue, 600),
));
@import "~vue-material/dist/theme/all";

// app-wide helpers
.md-scrollbar,
.md-scroll-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.md-scroll {
  flex: 1;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

html * {
  box-sizing: border-box; // fix `.md-ripple` offset bug?
}
html,
body {
  @extend .md-scroll-frame;
}
.md-app {
  flex-direction: column;
  flex: 1;
}
.md-app-content {
  padding: 0;
}

.md-list {
  > .md-list-item {
    flex-shrink: 0;

    .badge {
      line-height: 1.2;
      background-color: rgba(0,0,0,.2);
      color: #FFF;
      font-size: .85em;
      padding: 2px 6px;
      margin-right: 12px;
      border-radius: 10px;
      opacity: 1;
      transition: opacity 300ms;
    }
    .md-list-item-container {
      .md-subheader {
        flex-grow: 1;
        padding-left: 0;

        .md-icon {
          font-size: 14px;
          margin-left: 4px;
        }
        ~ .md-list-expand-indicator {
          flex: 0;
        }
      }
      .md-list-item-text {
        display: inline-block;
        text-overflow: ellipsis;
      }
      &:not(.md-active) {
        .badge {
          opacity: 0;
        }
      }
    }
  }
  &.md-transparent {
    background-color: transparent;
  }
}

.md-avatar {
  &.md-avatar-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #FFF;
    font-size: 16px;
  }
}

.md-toolbar {
  flex-shrink: 0;
  z-index: 200; // > 101 .ht_clone_top
}

.md-tabs {
  @extend .md-scroll-frame;

  .md-tabs-navigation {
    flex-shrink: 0;
  }
  .md-tabs-content,
  .md-tabs-container,
  .md-tab {
    height: 100% !important;
  }
  .md-tab {
    padding: 0;
  }
}

.md-steppers {
  @extend .md-scroll-frame;

  .md-steppers-navigation {
    flex-shrink: 0;
  }
  .md-steppers-wrapper {
    flex: 1;
  }
  .md-steppers-container,
  .md-stepper-content,
  .md-stepper {
    height: 100% !important;
  }
  .md-stepper {
    padding: 0;

    .md-stepper-content {
      @extend .md-scroll-frame;
    }
  }
}

.swiper-slide {
  @extend .md-scroll-frame;
}

.md-padding {
  padding: 12px 16px;
}


// component styles
.md-dialog {
  aside {
    margin-top: 16px;
  }
}
.md-dialog-login,
.md-dialog-register {
  form {
    padding: 12px;

    > footer {
      display: flex;
      justify-content: space-between;

      .md-button {
        &:first-child {
          margin-left: 0;
        }
        &:last-child {
          margin-right: 0;
        }
      }
    }
  }
}

.md-app-drawer {
  display: flex;
  flex-direction: column;
}

.md-account-header {
  padding: 0;

  .account-buttons {
    display: flex;
    flex-direction: column;
    margin: 0 auto;
  }
  .md-list {
    width: 100%;

    .md-list-item {
      .md-list-item-container {
        color: #fff !important;
      }
      .md-list-action {
        .md-icon {
          transform: rotate(0);
          transition: transform 300ms;
        }
      }
      &.toggled {
        .md-list-action {
          .md-icon {
            transform: rotate(180deg);
          }
        }
      }
    }
  }

  &:before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("/static/touchicon.svg") center center / cover;
    opacity: .25;
    pointer-events: none;
    z-index: 0;
  }
}

// account panel transition
@keyframes animate-in {
  0% { opacity: 0; transform: translate3d(0, -50%, 0); }
  100% { opacity: 1; transform: translate3d(0, 0, 0); }
}
.animate-in {
  > * {
    transform-origin: center top;
    animation: animate-in 300ms forwards;
  }
}
</style>
