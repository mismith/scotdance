<template>
  <div id="app" class="md-scroll-frame md-scroll">

    <md-sidenav ref="sidebar" md-swipeable @close="toggleAccount(false)" class="md-left md-fixed">
      <md-toolbar class="md-account-header">
        <div v-if="!me" class="account-buttons">
          <md-button @click="$refs.register.open()" class="md-raised" style="margin-left: auto; margin-right: auto;">
            <span>Register</span>
          </md-button>
          <md-button @click="$refs.login.open()" class="md-raised" style="margin-left: auto; margin-right: auto;">
            <span>Login</span>
          </md-button>
        </div>
        <md-list v-else class="md-transparent">
          <md-list-item>
            <md-avatar class="md-large" :style="{background: `url(${me.photoURL}) center center / cover no-repeat`}" />
          </md-list-item>
          <md-list-item @click="toggleAccount()" :class="{toggled: accountToggled}">
            <div class="md-list-text-container">
              <span>{{ me.displayName }}</span>
              <span>{{ me.email }}</span>
            </div>
            <md-button class="md-icon-button md-list-action" @click="toggleAccount()">
              <md-icon>arrow_drop_down</md-icon>
            </md-button>
          </md-list-item>
        </md-list>
      </md-toolbar>

      <md-list v-if="accountToggled" class="animate-in">
        <md-subheader>Account</md-subheader>
        <md-list-item @click="logout().then(toggleAccount)">
          <md-icon>exit_to_app</md-icon>
          <span>Logout</span>
        </md-list-item>
      </md-list>
      <md-list v-else>
        <md-subheader>Competitions</md-subheader>
        <md-list-item
          v-for="competition in competitions"
          :key="competition[idKey]"
          @click="$router.push(`/competitions/${competition[idKey]}`); $refs.sidebar.toggle();"
        >
          <md-icon>event</md-icon>
          <span>{{ competition.name }}</span>
          <md-button v-if="me && me.admin" class="md-icon-button md-list-action" @click="$router.push(`/competitions/${competition[idKey]}/admin`); $refs.sidebar.toggle();">
            <md-icon>settings</md-icon>
          </md-button>
        </md-list-item>

        <md-list-item v-if="me && me.admin" @click="$router.push(`/competitions/${db.push().key}/admin`); $refs.sidebar.toggle();">
          <md-icon>add</md-icon>
          <span>Add new</span>
        </md-list-item>
      </md-list>
    </md-sidenav>

    <md-toolbar>
      <div class="md-toolbar-container">
        <md-button class="md-icon-button" @click="$refs.sidebar.toggle()">
          <md-icon>menu</md-icon>
        </md-button>

        <h2 class="md-title">{{ title || 'ScotDance' }}</h2>

        <span class="md-flex"></span>

        <!--<md-button class="md-icon-button">
          <md-icon>search</md-icon>
        </md-button>-->
      </div>
    </md-toolbar>

    <main id="main" class="md-scroll-frame md-scroll">
      <router-view :key="$route.fullPath" />
    </main>

    <md-dialog ref="login" class="md-dialog-login">
      <md-swiper ref="loginSwiper" class="md-swiper-login">
        <md-board>
          <form @submit.prevent="login(credentials).then($refs.login.close)">
            <md-input-container>
              <label>Email</label>
              <md-input type="email" name="email" v-model="credentials.email" required autofocus />
            </md-input-container>
            <md-input-container md-has-password>
              <label>Password</label>
              <md-input type="password" name="password" v-model="credentials.password" required />
            </md-input-container>

            <footer>
              <md-spinnable :md-spinning="authLoading">
                <md-button type="submit" class="md-primary md-raised">Login</md-button>
              </md-spinnable>

              <md-button @click="$refs.loginSwiper.next()" class="ml-auto">Forgot?</md-button>
            </footer>

            <aside v-if="authError">
              {{ authError.message }}
            </aside>
          </form>
        </md-board>
        <md-board>
          <form @submit.prevent="forgot(credentials).then(handlePasswordReset)">
            <header>
              <p>We can send you a link to reset your password.</p>
              <br />
            </header>

            <md-input-container>
              <label>Email</label>
              <md-input type="email" name="email" v-model="credentials.email" required autofocus />
            </md-input-container>

            <footer>
              <md-spinnable :md-spinning="authLoading">
                <md-button type="submit" class="md-primary md-raised">Send</md-button>
              </md-spinnable>

              <md-button @click="$refs.loginSwiper.prev()">Cancel</md-button>
            </footer>

            <aside v-if="authMessage">
              {{ authMessage }}
            </aside>
          </form>
        </md-board>
      </md-swiper>
    </md-dialog>
    <md-dialog ref="register" class="md-dialog-register">
      <form @submit.prevent="register(credentials).then($refs.register.close)">
        <md-input-container>
          <label>Email</label>
          <md-input type="email" name="email" v-model="credentials.email" required autofocus />
        </md-input-container>
        <md-input-container md-has-password>
          <label>Password</label>
          <md-input type="password" name="password" v-model="credentials.password" required />
        </md-input-container>

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

  </div>
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

      title: '',
    };
  },
  firebase: {
    competitions: db.child('competitions'),
  },
  watch: {
    title(title) {
      window.document.title = title || 'ScotDance';
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
  mounted() {
    this.$refs.register.$on('open', () => {
      this.authError = null;
    });
    this.$refs.login.$on('open', () => {
      this.authError = null;
    });
    this.$refs.login.$on('close', () => {
      this.authMessage = null;
    });
  },
};
</script>

<style lang="scss">
html,
body {
  @extend .md-scroll-frame;
}

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

.md-dialog {
  aside {
    margin-top: 16px;
  }
}

.md-toolbar {
  &.md-account-header {
    .account-buttons {
      display: flex;
      flex-direction: column;
      margin: 0 auto;
    }
    .md-list-item {
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
    .md-list-item-container,
    .md-button-ghost {
      &:hover:not([disabled]) {
        background-color: transparent !important;
      }
    }
    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url(/static/touchicon.svg) center center / cover;
      opacity: .25;
      pointer-events: none;
      z-index: 0;
    }
  }
}

.md-list {
  > .md-list-item {
    flex-shrink: 0;

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
    }
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
    &:not(.md-active) {
      .badge {
        opacity: 0;
      }
    }
  }
  .md-avatar {
    &.md-avatar-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #FFF;
    }
  }
}

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

[class*="icon-"].md-icon {
  font-size: 20px;
  padding-left: 2px;
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
</style>
