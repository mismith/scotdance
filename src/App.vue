<template>
  <v-app id="app" class="app-scroll-frame">
    <v-toolbar app color="primary" dark class="print-hide">
      <v-toolbar-side-icon @click="menuVisible = !menuVisible" />

      <v-toolbar-title>
        <router-link :to="{ name: 'competitions' }">{{ title }}</router-link>
      </v-toolbar-title>

      <v-spacer />

      <v-btn
        icon
        v-if="$route.params.competitionId && $store.getters.hasPermission(`competitions/${$route.params.competitionId}`) && getMirrorRoute()"
        :to="getMirrorRoute()"
      >
        <v-icon>{{ /^competition.admin/.test($route.name) ? 'visibility' : 'settings' }}</v-icon>
      </v-btn>

      <v-menu>
        <v-btn icon slot="activator">
          <v-icon>help</v-icon>
        </v-btn>

        <v-list>
          <v-list-tile :to="{ name: 'home', query: { at: 'about' } }" exact>
            <v-list-tile-title>About</v-list-tile-title>
          </v-list-tile>
          <v-list-tile :to="{ name: 'home', query: { at: 'faq' } }" exact>
            <v-list-tile-title>FAQs</v-list-tile-title>
          </v-list-tile>
          <v-divider />
          <v-list-tile @click="help(true)">
            <v-list-tile-title>Feedback</v-list-tile-title>
          </v-list-tile>
          <v-list-tile v-if="$store.state.helpVisible" @click="help(false)">
            <v-list-tile-title class="error--text">Hide Live Chat</v-list-tile-title>
          </v-list-tile>
          <v-divider />
          <v-list-tile @click="confirmClearLocalStorage = true">
            <v-list-tile-title>Clear App Cache</v-list-tile-title>
          </v-list-tile>
        </v-list>

        <dialog-card
          v-model="confirmClearLocalStorage"
          title="Clear App Cache"
          cancel-label="No"
          submit-label="Yes"
          @submit="clearLocalStorage()"
        >
          <p>In order to enhance performance and usability, this app stores certain settings in your device's local storage cache.</p>
          <p>If you are ever encountering layout or navigation bugs, clearing these may help resolve certain issues related to:</p>
          <ul class="mb-3">
            <li>expanded/collapsed states</li>
            <li>active/last-used screens</li>
            <li>stored scroll positions</li>
          </ul>
          <p><strong>Are you sure you want to permanently erase these stored settings?</strong></p>
        </dialog-card>
      </v-menu>
    </v-toolbar>

    <v-navigation-drawer v-model="menuVisible" app touchless class="app-scroll-frame">
      <header class="account-header primary flex-none">
        <div class="account-bg"></div>
        <account-buttons v-if="!me" class="pa-3" />
        <div v-else>
          <v-list three-line>
            <v-list-tile class="has-avatar">
              <v-avatar :size="64">
                <gravatar :user="me" />
              </v-avatar>
            </v-list-tile>
          </v-list>
          <v-list dark>
            <v-list-group v-model="accountToggled" no-action>
              <v-list-tile slot="activator">
                <v-list-tile-content>
                  <v-list-tile-title>
                    {{ me.displayName || me.email || 'Account' }}
                  </v-list-tile-title>
                </v-list-tile-content>
              </v-list-tile>
            </v-list-group>
          </v-list>
        </div>

        <register-dialog />
        <login-dialog />
        <requires-auth-dialog name="favorites">
          <v-card-title slot="title" class="title">
            Track your favourites
            <v-icon color="secondary">star</v-icon>
          </v-card-title>

          <p>To see the dancers you care most about <strong>featured throughout the app</strong>, you'll need an account first.</p>
          <p>Fortunately, it takes <strong>less than 30 seconds</strong>—all you need is an email and password.</p>
        </requires-auth-dialog>
      </header>

      <div class="app-scroll-frame app-scroll">
        <v-list v-if="accountToggled" class="layout column flex">
          <v-subheader>Account</v-subheader>

          <v-list-tile :to="{ name: 'profile' }" @click="closeMenu()">
            <v-list-tile-action>
              <v-icon>account_circle</v-icon>
            </v-list-tile-action>
            <v-list-tile-title>My Profile</v-list-tile-title>
          </v-list-tile>

          <v-spacer />
          <v-divider />
          <v-list-tile @click="logout().then(toggleAccount)">
            <v-list-tile-action>
              <v-icon>exit_to_app</v-icon>
            </v-list-tile-action>
            <v-list-tile-title>Logout</v-list-tile-title>
          </v-list-tile>
        </v-list>

        <template v-else>
          <v-list two-line>
            <v-subheader>
              <v-flex>Competitions</v-flex>

              <v-btn
                icon
                v-if="$store.getters.hasPermission('admin')"
                :to="{ name: 'competition.admin.info', params: { competitionId: db.push().key } }"
                @click="closeMenu()"
              >
                <v-icon>add</v-icon>
              </v-btn>
            </v-subheader>

            <competition-list-item
              v-for="competition in relevantCompetitions"
              :key="competition[idKey]"
              :competition="competition"
              :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }"
              @click="closeMenu()"
            />

            <v-list-tile v-if="!relevantCompetitions.length" class="empty">
              <v-list-tile-avatar>
                <v-icon>clear</v-icon>
              </v-list-tile-avatar>
              No competitions found.
            </v-list-tile>

            <footer
              v-if="competitions.length && competitions.length !== relevantCompetitions.length"
              style="text-align: center;"
            >
              <v-btn flat :to="{ name: 'competitions' }" @click="closeMenu()">
                View {{ competitions.length - relevantCompetitions.length }} More
              </v-btn>
            </footer>
          </v-list>

          <v-spacer />
          <v-divider />
          <v-list>
            <v-subheader>Links</v-subheader>

            <v-list-tile to="/" exact @click="closeMenu()">
              <v-list-tile-action>
                <v-icon>home</v-icon>
              </v-list-tile-action>
              <v-list-tile-title>App Home</v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              v-if="$store.getters.hasPermission('admin')"
              :to="{ name: 'admin.info' }"
              @click="closeMenu()"
            >
              <v-list-tile-action>
                <v-icon>settings_applications</v-icon>
              </v-list-tile-action>
              <v-list-tile-title>App Admin</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </template>
      </div>
    </v-navigation-drawer>

    <v-content id="main" class="app-scroll-frame">
      <keep-alive v-if="!$store.state.loading && $store.state.me !== undefined">
        <router-view
          v-bind="{
            competitions,
            competitionsRef,
            competitionsDataRef,
          }"
        />
      </keep-alive>
      <div v-else class="app-scroll-frame">
        <spinner />
      </div>
    </v-content>
  </v-app>
</template>

<script>
import Hammer from 'hammerjs';
import {
  mapState,
  mapActions,
} from 'vuex';
import { getTitleChunks, getFirstExisting } from '@/helpers/router';
import {
  idKey,
  db,
  firebase,
} from '@/helpers/firebase';
import RegisterDialog from '@/components/utility/RegisterDialog.vue';
import LoginDialog from '@/components/utility/LoginDialog.vue';
import RequiresAuthDialog from '@/components/utility/RequiresAuthDialog.vue';
import AccountButtons from '@/components/utility/AccountButtons.vue';
import CompetitionListItem from '@/components/utility/CompetitionListItem.vue';

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

      confirmClearLocalStorage: false,
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
        .filter(competition => competition.listed || this.$store.getters.hasPermission(`competitions/${competition[idKey]}`))
        .sort((a, b) => this.$moment(a.date).diff(b.date)); // order chronologically
    },
    relevantCompetitions() {
      const relevantCompetitions = this.competitions.filter((competition) => {
        // only show upcoming or up to a week old events
        if (competition.date && this.$moment().isSameOrBefore(competition.date, 'week')) {
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

    getMirrorRoute() {
      const [, isAdmin, tabName] = this.$route.name.match(/^competition\.(admin\.)?([^.]+?)$/);
      const mirrorBaseName = `competition${isAdmin ? '' : '.admin'}`;
      const tab = this.$route.params.tab || tabName;
      const params = {
        competitionId: this.$route.params.competitionId,
      };

      return getFirstExisting({
        name: `${mirrorBaseName}.${tab}`,
        params,
      }, {
        name: `${mirrorBaseName}.tab`,
        params: {
          ...params,
          tab,
        },
      }, {
        name: `${mirrorBaseName}.info`,
        params,
      });
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

    // scroll to selector if specified in query string
    this.$watch('$route', (to) => {
      if (to.query.at) {
        this.$nextTick(() => {
          this.$scrollAll(`#${to.query.at}`);
        });
      }
    }, { immediate: true });
  },
  components: {
    RegisterDialog,
    LoginDialog,
    RequiresAuthDialog,
    AccountButtons,
    CompetitionListItem,
  },
};
</script>

<style lang="scss">
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
.app-scroll-frame {
  display: flex;
  flex-direction: column;
  flex: auto;
  overflow: hidden;
}
.app-scroll {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
.flex-none {
  flex: none;
}

// transitions
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
a {
  &.ext,
  & .ext {
    &:after {
      content: "\2197\FE0E"; // append \FE0E to prevent iOS from emojifying the arrow
      margin-left: 0.25em;
    }
  }
}
.alt {
  background-color: rgba(0, 0, 0, 0.1);
}
.pre-line {
  white-space: pre-line;
}
.empty,
.dimmed {
  opacity: 0.5;
}

// app frame
html,
body,
#app {
  height: 100%;
  overflow: hidden;
}
.application--wrap,
.v-content__wrap {
  @extend .app-scroll-frame;
}

// framework component styling
.v-dialog {
  &,
  .v-card,
  .v-stepper,
  .v-stepper__items,
  .v-stepper__content,
  .v-stepper__wrapper,
  .v-tabs,
  .v-window,
  .v-window__container,
  .v-window-item {
    display: flex;
    flex-direction: column;
    flex: auto;
  }
  .v-stepper__header,
  .v-tabs__bar {
    flex-shrink: 0;
  }

  &--scrollable > .v-card {
    width: 100%;

    > .v-card__text {
      @extend .app-scroll;
    }
  }
}
.v-bottom-nav {
  flex-shrink: 0;
}
.v-toolbar {
  z-index: 1;

  .v-toolbar__title {
    a {
      color: inherit;
      text-decoration: none;
    }
  }
}
.v-subheader {
  flex: none;

  .v-btn {
    margin-right: -8px;
  }
}
.v-avatar {
  &.primary,
  &.secondary,
  &.grey {
    color: #fff;

    .v-icon {
      color: inherit;
    }
  }
}
.v-list {
  .v-input--switch {
    .v-input__control {
      margin: auto;
    }
    .v-input--selection-controls__input {
      margin-right: 0;
    }
  }

  &.grouped {
    background-color: transparent;

    .v-list__group {
      .v-list__group__header {
        .v-subheader {
          padding-right: 0;
        }
      }
    }
  }
}

// tables
.handsontable {
  height: 100vh;
  z-index: 0;
}

// drag-n-drop
.sortable-handle {
  .v-list__tile & {
    order: -1;
    height: 100%;
    margin-left: -16px;
    opacity: 0.5;
    cursor: move;
  }
}
.sortable-chosen,
.sortable-ghost {
  .v-list__tile {
    opacity: 0.5;
    border-top: dashed 2px #ccc;
    border-bottom: dashed 2px #ccc;
  }
  &.v-chip {
    opacity: 0.5;
  }
}
.sortable-drag {
  opacity: 0;
}

// component styles
.account-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url('./assets/img/touchicon.png');
  background-position: center center;
  background-size: cover;
  opacity: .25;
  pointer-events: none;
}
.account-header {
  position: relative;
  min-height: 128px;

  .v-list {
    padding: 0;
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
