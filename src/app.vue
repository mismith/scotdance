<template>
  <md-app id="app" class="md-scroll-frame">
    <md-app-toolbar class="md-primary print-hide" style="flex-wrap: nowrap;">
      <md-button class="md-icon-button" @click="menuVisible = !menuVisible">
        <md-icon>menu</md-icon>
      </md-button>

      <router-link :to="{ name: 'competitions' }" class="md-title" style="margin-right: auto;">{{ title }}</router-link>

      <md-button
        v-if="me && me.admin && $route.params.competitionId"
        :to="{ name: /^competition.admin/.test($route.name) ? 'competition.info' : 'competition.admin' }"
        class="md-icon-button"
      >
        <md-icon>{{ /^competition.admin/.test($route.name) ? 'visibility' : 'settings' }}</md-icon>
      </md-button>

      <md-menu>
        <md-button md-menu-trigger class="md-icon-button">
          <md-icon>help</md-icon>
        </md-button>

        <md-menu-content>
          <md-menu-item :to="{ name: 'home', query: { at: '#about' } }">About</md-menu-item>
          <md-menu-item :to="{ name: 'home', query: { at: '#faq' } }">FAQs</md-menu-item>
          <md-menu-item :to="{ name: 'home', query: { at: '#tech' } }">Tech</md-menu-item>
          <md-divider />
          <md-menu-item @click="help(true)">Feedback</md-menu-item>
          <md-menu-item v-if="$store.state.helpVisible" @click="help(false)" class="md-accent">Hide Live Chat</md-menu-item>
        </md-menu-content>
      </md-menu>
    </md-app-toolbar>

    <md-app-drawer :md-active.sync="menuVisible">
      <md-toolbar class="md-primary md-large md-account-header">
        <div class="account-bg" style="background-image: url('static/img/touchicon.png');"></div>
        <favorites-dialog />
        <register-dialog />
        <login-dialog />
        <account-buttons v-if="!me" class="md-padding" />
        <md-list v-else class="md-transparent">
          <md-list-item>
            <md-avatar class="md-large">
              <img
                :src="me.photoURL || `https://avatars.io/gravatar/${me.email}`"
                :alt="me.displayName"
              />
            </md-avatar>
          </md-list-item>
          <md-list-item @click="toggleAccount()" :class="{ toggled: accountToggled }">
            <div class="md-list-item-text">
              <span>{{ me.displayName || me.email || 'Account' }}</span>
            </div>
            <md-button class="md-icon-button md-list-action" @click.stop="toggleAccount()">
              <md-icon>arrow_drop_down</md-icon>
            </md-button>
          </md-list-item>
        </md-list>
      </md-toolbar>

      <div class="md-scroll-frame md-scroll">
        <md-list v-if="accountToggled" class="animate-in" style="flex: auto;">
          <md-subheader>Account</md-subheader>

          <md-list-item :to="{ name: 'profile' }" @click="closeMenu()">
            <md-icon>account_circle</md-icon>
            <span class="md-list-item-text">My Profile</span>
          </md-list-item>

          <md-divider style="margin-top: auto;" />
          <md-list-item @click="clearLocalStorage()">
            <md-icon>cached</md-icon>
            <span class="md-list-item-text">Reset App Data</span>
          </md-list-item>
          <md-list-item @click="logout().then(toggleAccount)">
            <md-icon>exit_to_app</md-icon>
            <span class="md-list-item-text">Logout</span>
          </md-list-item>
        </md-list>
        <md-list v-if="!accountToggled" class="md-double-line md-dense" style="margin-bottom: auto;">
          <md-subheader>
            <div>Competitions</div>

            <md-button
              v-if="me && me.admin"
              :to="{ name: 'competition.admin', params: { competitionId: db.push().key } }"
              @click.native="closeMenu()"
              class="md-icon-button"
            >
              <md-icon>add</md-icon>
            </md-button>
          </md-subheader>

          <competition-list-item
            v-for="competition in relevantCompetitions"
            :key="competition[idKey]"
            :competition="competition"
            :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }"
            @click.native="closeMenu()"
          />

          <md-list-item v-if="!relevantCompetitions.length" class="empty">
            No competitions found.
          </md-list-item>

          <footer v-if="competitions.length && competitions.length !== relevantCompetitions.length" style="text-align: center;">
            <md-button :to="{ name: 'competitions' }" @click.native="closeMenu()">
              View {{ competitions.length - relevantCompetitions.length }} More
            </md-button>
          </footer>
        </md-list>

        <md-list v-if="!accountToggled" class="md-dense">
          <md-subheader>Links</md-subheader>

          <md-list-item to="/" @click="closeMenu()">
            <md-icon>home</md-icon>
            <span class="md-list-item-text">App Home</span>
          </md-list-item>
        </md-list>
      </div>
    </md-app-drawer>

    <md-app-content id="main" class="md-scroll-frame">
      <keep-alive>
        <router-view
          :competitions="competitions"
          :competitions-ref="competitionsRef"
          :competitions-data-ref="competitionsDataRef"
        />
      </keep-alive>
    </md-app-content>
  </md-app>
</template>

<script>
import Hammer from 'hammerjs';
import {
  mapState,
  mapActions,
} from 'vuex';
import {
  getTitleChunks,
} from '@/helpers/router';
import {
  idKey,
  db,
  firebase,
} from '@/helpers/firebase';
import RegisterDialog from '@/components/utility/register-dialog';
import LoginDialog from '@/components/utility/login-dialog';
import FavoritesDialog from '@/components/utility/favorites-dialog';
import AccountButtons from '@/components/utility/account-buttons';
import CompetitionListItem from '@/components/utility/competition-list-item';

export default {
  name: 'app',
  data() {
    return {
      idKey,
      db,

      accountToggled: false,
      menuVisible: false,

      competitionsRef: undefined,
      competitionsDataRef: undefined,
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),

    competitions() {
      return this.competitionsRaw
        .map(competition => ({
          ...competition,
          $favorite: this.$store.getters.isFavorite('competitions', competition[idKey]),
        }))
        .filter(competition => competition.published || (this.me && this.me.admin))
        .sort((a, b) => this.$moment(a.date).diff(b.date)); // order chronologically
    },
    relevantCompetitions() {
      const relevantCompetitions = this.competitions.filter((competition) => {
        // only show upcoming or up to 7 day old events
        if (competition.date && this.$moment().isSame(competition.date, 'week')) {
          return true;
        }
        return false;
      });

      // limit to 10 relevant competitions at most
      if (relevantCompetitions.length) {
        return relevantCompetitions.slice(0, 10);
      }
      // fallback to showing (up to) 10 most recent competitions if no relevant ones are found
      return this.competitions.slice(-10);
    },
  },
  asyncComputed: {
    async title() {
      const titleChunks = await getTitleChunks(this.$route);

      if (titleChunks.length > 2) {
        return titleChunks[titleChunks.length - 2];
      } else if (this.$route.name === 'competition.info') {
        return titleChunks[0];
      }
      return titleChunks[titleChunks.length - 1];
    },
  },
  watch: {
    me(me) {
      if (me) {
        if (window.SessionStack && me[idKey]) {
          window.SessionStack.identify({
            userId: me[idKey],
            email: me.email,
            displayName: me.displayName || me.email || me[idKey],
          });
        }
        if (window.$crisp && me.email) {
          window.$crisp.push(['set', 'user:email', me.email]);
        }
      }
    },
    $route(to) {
      // scroll to selector if specified in query string
      if (to.query.at) {
        this.$nextTick(() => {
          this.$scrollAll(to.query.at);
        });
      }
    },
  },
  methods: {
    ...mapActions([
      'help',
    ]),

    async loadFirebase() {
      this.competitionsRef = db.child('competitions');
      this.competitionsDataRef = db.child('competitions:data');

      if (this.competitionsRaw) this.$unbind('competitionsRaw');
      this.$bindAsArray('competitionsRaw', this.competitionsRef);
    },

    closeMenu() {
      this.menuVisible = false;
      this.accountToggled = false;
    },
    toggleAccount(accountToggled = undefined) {
      this.accountToggled = accountToggled !== undefined ? accountToggled : !this.accountToggled;
    },

    handleSwipeToGoBack() {
      window.history.go(-1);
    },

    clearLocalStorage() {
      if (window.localStorage) {
        window.localStorage.clear();
        window.location.reload();
      }
    },
    logout() {
      return firebase.auth().signOut();
    },
  },
  created() {
    this.loadFirebase();
  },
  mounted() {
    new Hammer(this.$el, {
      touchAction: 'auto',
    })
      .on('swipeleft', () => {
        this.closeMenu();
      })
      .on('swiperight', ({ deltaX, srcEvent: { pageX } }) => {
        const EDGE_THRESHOLD = 64;
        const startLeft = pageX - deltaX;
        // const startRight = window.innerWidth - startRight;
        if (startLeft <= EDGE_THRESHOLD) {
          window.history.go(-1);
        }
      });
  },
  components: {
    RegisterDialog,
    LoginDialog,
    FavoritesDialog,
    AccountButtons,
    CompetitionListItem,
  },
};
</script>

<style lang="scss">
// custom vue-material theme
@import "~vue-material/dist/theme/engine";
@include md-register-theme("default", (
  primary: md-get-palette-color(blue, 600),
  accent: md-get-palette-color(pink, 500)
));
@import "~vue-material/dist/theme/all";

// import simple-line-icons
$simple-line-font-path: "~simple-line-icons/fonts/";
@import "~simple-line-icons/scss/simple-line-icons";

// extension styling overrides
body.has-bottom-bar {
  #crisp-chatbox {
    > div {
      > a {
        margin-bottom: 56px !important;
      }
    }
  }
}

// app-wide helpers
.md-scroll-frame {
  display: flex;
  flex-direction: column;
  flex: auto;
  overflow: hidden;

  &.spinner-container {
    justify-content: center;
    align-items: center;
  }
}
.md-scroll {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
.md-subheader {
  > div {
    flex: auto;

    + * {
      text-align: right;
      margin-right: -10px;
    }
  }
  &.md-title {
    color: inherit;
    font-size: 24px;
    padding-top: 16px;
  }
  &.md-list-item:first-of-type {
    margin-top: 0;
  }
}
.md-bg-primary {
  background-color: var(--md-theme-default-primary);
}

// transitions
.blades {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  position: relative;
  overflow: hidden;

  .blade:not(.admin-blade) {
    width: 100%;

    + .blade {
      // @HACK to avoid post-animation flicker on iOS
      // this essentially causes `position: absolute` on the incoming blade—e.g. to allow stacking
      // but without altering the scroll position (which gums up the persist-scroll directive)
      margin-left: -100%;
    }
  }
}
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 250ms;
}
.slide-left-enter,
.slide-right-leave-to {
  transform: translate3d(100%, 0, 0);
  opacity: 0;
}
.slide-left-leave-to,
.slide-right-enter {
  transform: translate3d(-25%, 0, 0);
  opacity: 0;
}

// app-wide custom styling
a.ext {
  &:after {
    content: "\2197";
    margin-left: 0.25em;
  }
}
.alt {
  background-color: rgba(0, 0, 0, 0.1);
}

// app frame
html * {
  box-sizing: border-box; // fix `.md-ripple` offset bug?
}
html,
body,
.md-app-container,
.md-app-scroller {
  @extend .md-scroll-frame;
}
.md-app {
  flex-direction: column;
  flex: 1;
  margin-bottom: env(safe-area-inset-bottom); // iPhone X
  z-index: 3;
}
.md-app-content {
  padding: 0;
}
.md-dialog-overlay {
  z-index: 9; // cover .md-app-drawer
}
.md-select-menu {
  z-index: 11; // cover .md-dialog
}
.md-layout-item {
  flex: 1 0 auto; // fix iOS <= 10.2 flexbug
}

// app-wide md-component styling
.md-list {
  flex-shrink: 0;

  > .md-list-item {
    flex-shrink: 0;

    .md-list-item-container {
      .md-list-item-content {
        .md-subheader {
          flex-grow: 1;
          padding-left: 0;

          .md-icon {
            font-size: 14px;
            margin-left: 4px;

            &.summary-icon {
              margin-left: auto;
              margin-right: -16px;
              transition: opacity .3s;
            }
          }
          ~ .md-list-expand-indicator {
            flex: 0;
          }
        }
      }
      .md-list-item-text {
        display: inline-block;
        text-overflow: ellipsis;
      }
    }
    &.md-active {
      .md-icon {
        &.summary-icon {
          opacity: 0;
        }
      }
    }
    &.active {
      background-color: var(--md-theme-default-primary) !important;

      > .md-list-item-container {
        .md-list-item-content {
          color: #fff;
        }
      }
    }
    &.empty {
      .md-list-item-content {
        font-size: small;
        font-style: italic;
        opacity: 0.5;
      }
    }
  }
  &.md-transparent {
    background-color: transparent;
  }
  &.md-dense {
    .md-list-item-content {
      > .md-icon {
        &:first-child {
          margin-right: 16px;
        }
      }
      .md-list-action {
        &:last-of-type {
          margin-left: 8px;
        }
      }
    }
  }
  &.md-list-cards {
    background-color: initial;
    padding: 0 0 12px;

    > .md-list-item {
      > .md-list-item-container {
        background-color: initial !important;
        border: 0 !important;

        > .md-list-expand {
          > .md-list {
            padding: 0;
            margin: 0 16px 8px;
            box-shadow: 0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12); // .md-elevation-1
          }
        }
      }
    }
  }
}
.md-menu-content {
  max-height: 50vh; // for toolbar help button (w/ hide live chat visible)
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

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  a.md-title {
    text-decoration: none;
  }

  &.md-toolbar-nowrap {
    flex-wrap: nowrap;
  }
}

.md-tabs {
  @extend .md-scroll-frame;

  &-navigation {
    flex-shrink: 0;

    .md-button {
      min-width: 48px !important;
    }
  }
  &-content {
    position: relative;
    flex: auto;
  }
  &-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
  .md-tab {
    padding: 0;

    &,
    > .md-scroll-frame {
      height: 100%;
    }
  }
}

.md-dialog {
  .md-steppers {
    @extend .md-scroll-frame;

    font-size: 1.2em;

    .md-steppers-navigation {
      flex-shrink: 0;
    }
    .md-steppers-wrapper {
      flex: 1;
    }
    &,
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
}

.md-button {
  &.md-large {
    height: 48px;
    font-size: 16px;

    .md-ripple {
      padding-left: 16px;
      padding-right: 16px;
    }
  }
}

.md-padding {
  padding: 12px 16px;
}

// component styles
.validation-message {
  color: var(--md-theme-default-accent) !important;
  margin-top: 16px;
}

.md-app-toolbar {
  z-index: 3; // > 2 .md-app
}
.md-app-drawer {
  display: flex;
  flex-direction: column;
  touch-action: pan-y;
}

.login-dialog,
.register-dialog,
.change-password-dialog,
.remove-user-dialog {
  p {
    color: #666;
  }
  .md-dialog-actions {
    display: flex;
    justify-content: space-between;
    padding-left: 16px;
    padding-right: 24px;
    padding-bottom: 12px;

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

.account-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-position: center center;
  background-size: cover;
  opacity: .25;
  pointer-events: none;
  z-index: 0;
}
.md-account-header {
  padding: 0;

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

// print overrides
.print-show {
  display: none !important;
}
@media print {
  html,
  body,
  #app,
  #main {
    width: 11in;
    height: 8.5in;
    background-color: transparent !important;
    overflow: hidden;
    padding: 0;
    margin: 0;
    border: 0;
  }
  .home {
    > * {
      &:not(.hero) {
        display: none;
      }
      &.hero {
        width: 5.5in;
        height: 4.25in;

        h1,
        p {
          margin: 10px;
        }
      }
    }
  }

  .print-show {
    display: unset !important;
  }
  .print-hide {
    display: none !important;
  }
}
</style>
