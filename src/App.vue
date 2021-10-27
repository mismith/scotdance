<template>
  <v-app id="app" class="app-scroll-frame">
    <v-app-bar
      app
      dark
      absolute
      color="primary"
      class="print-hide"
      :class="{ stripes: env !== 'production' }"
    >
      <v-btn icon @click="menuVisible = !menuVisible" aria-label="menu">
        <v-badge v-model="needsUpdating" dot color="secondary">
          <v-icon>{{ mdiMenu }}</v-icon>
        </v-badge>
      </v-btn>

      <v-toolbar-title>
        <router-link :to="{ name: 'home' }" aria-label="home">{{ title }}</router-link>
      </v-toolbar-title>

      <v-spacer />

      <template v-if="$route.params.competitionId && $store.getters.hasPermission(`competitions/${$route.params.competitionId}`) && getMirrorRoute()">
        <v-tooltip :disabled="isTouch" bottom :open-delay="600">
          <template #activator="{ on }">
            <v-btn
              icon
              :to="getMirrorRoute()"
              v-on="on"
              aria-label="mirror"
            >
              <v-icon>{{ /^competition.admin/.test($route.name) ? mdiEye : mdiPencil }}</v-icon>
            </v-btn>
          </template>
          <span>
            {{ /^competition.admin/.test($route.name) ? 'View' : 'Edit' }} competition
          </span>
        </v-tooltip>
      </template>

      <v-menu v-model="submenuVisible" offset-y max-height="90%" max-width="calc(100% - 12px * 2)">
        <template #activator="{ on: menu }">
          <v-tooltip :disabled="isTouch || submenuVisible" bottom :open-delay="600">
            <template #activator="{ on: tooltip }">
              <v-btn icon v-on="Object.assign({}, tooltip, menu)" aria-label="submenu">
                <v-badge v-model="submenuIsNew" dot color="secondary">
                  <v-icon>{{ mdiDotsGrid }}</v-icon>
                </v-badge>
              </v-btn>
            </template>
            <span>Switch competitions</span>
          </v-tooltip>
        </template>

        <v-sheet class="app-scroll" style="max-width: 400px;">
          <AppSubmenu
            :competitions="competitions"
            :visible="submenuVisible"
          />
        </v-sheet>
      </v-menu>

      <v-menu v-model="accountVisible" offset-y>
        <template #activator="{ on: menu }">
          <v-tooltip :disabled="isTouch || accountVisible" bottom :open-delay="600">
            <template #activator="{ on: tooltip }">
              <v-btn icon class="mr-n2" v-on="Object.assign({}, tooltip, menu)">
                <v-avatar size="36">
                  <Gravatar v-if="me" :user="me" />
                  <v-icon v-else>{{ mdiAccountCircle }}</v-icon>
                </v-avatar>
              </v-btn>
            </template>
            <span>Account</span>
          </v-tooltip>
        </template>

        <v-sheet>
          <div v-if="!me" style="width: 300px; max-width: 100%;">
            <div class="body-2 pa-4">
              <p>To <strong>save and sync</strong> dancers, competitions, settings, and more, you'll need an account first.</p>
              <p>Fortunately, it takes <strong>less than 30 seconds</strong>—all you need is an email and password.</p>
            </div>
            <div class="pa-3 primary" style="position: relative;">
              <div class="account-bg"></div>
              <AccountButtons />
            </div>
            <v-card-actions class="justify-end pa-2">
              <v-btn text @click="accountVisible = false">Not Now</v-btn>
            </v-card-actions>
          </div>
          <template v-else>
            <v-list>
              <v-list-item :to="{ name: 'profile' }" @click="closeMenu()">
                <v-list-item-avatar>
                  <v-icon>{{ mdiAccountCircle }}</v-icon>
                </v-list-item-avatar>
                <v-list-item-content>
                  <v-list-item-title>My Profile</v-list-item-title>
                </v-list-item-content>
              </v-list-item>
            </v-list>

            <v-spacer />
            <v-divider />
            <v-list>
              <v-list-item @click="logout()">
                <v-list-item-avatar>
                  <v-icon>{{ mdiExitToApp }}</v-icon>
                </v-list-item-avatar>
                <v-list-item-content>
                  <v-list-item-title>Logout</v-list-item-title>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </template>
        </v-sheet>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer
      v-model="menuVisible"
      app
      touchless
      :width="320"
      class="app-scroll-frame"
    >
      <div class="app-scroll-frame app-scroll">
        <v-list>
          <v-subheader>Pages</v-subheader>
          <v-list-item :to="{ name: 'competitions' }" exact aria-label="competitions">
            <v-list-item-avatar>
              <v-icon>{{ mdiCalendarMonth }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>Browse Competitions</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item :to="{ name: 'competitions.submit' }" exact aria-label="competitions.submit">
            <v-list-item-avatar>
              <v-icon>{{ mdiSend }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>Submit Competition</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>

        <v-spacer />

        <v-list>
          <v-subheader>{{ $store.state.$package.$name }}</v-subheader>

          <v-list-item to="/" exact @click="closeMenu()">
            <v-list-item-avatar>
              <v-icon>{{ mdiHome }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>Home</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item
            :to="{ name: 'settings' }"
            @click="closeMenu()"
            aria-label="settings"
          >
            <v-list-item-avatar>
              <v-icon>{{ mdiCog }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>Settings</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item
            v-if="$store.getters.hasPermission('admin')"
            :to="{ name: 'admin.info' }"
            @click="closeMenu()"
            class="stripes"
          >
            <v-list-item-avatar>
              <v-icon>{{ mdiCogBox }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>Admin</v-list-item-title>
            </v-list-item-content>
          </v-list-item>

          <template v-if="$store.state.helpAvailable">
            <v-list-item @click="help(true); closeMenu();">
              <v-list-item-avatar>
                <v-icon>{{ mdiFrequentlyAskedQuestions }}</v-icon>
              </v-list-item-avatar>
              <v-list-item-title>Feedback</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="$store.state.helpVisible" @click="help(false); closeMenu();">
              <v-list-item-avatar>
                <v-icon>{{ mdiClose }}</v-icon>
              </v-list-item-avatar>
              <v-list-item-title class="error--text">Hide Live Chat</v-list-item-title>
            </v-list-item>
          </template>

          <template v-if="needsUpdating">
            <v-divider />
            <PromptToUpdate>
              <template #activator="{ on }">
                <v-list-item v-on="on">
                  <v-list-item-avatar>
                    <v-icon>{{ mdiNewBox }}</v-icon>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    <v-list-item-title>Update</v-list-item-title>
                  </v-list-item-content>
                  <v-badge inline content="1" color="secondary" />
                </v-list-item>
              </template>
            </PromptToUpdate>
          </template>
        </v-list>
      </div>

      <v-btn icon absolute class="ma-2" @click="closeMenu()">
        <v-icon>{{ mdiClose }}</v-icon>
      </v-btn>
    </v-navigation-drawer>

    <v-main id="main" class="app-scroll-frame">
      <router-view v-if="$store.state.me !== undefined" />
      <div v-else class="app-scroll-frame">
        <Spinner />
      </div>
    </v-main>

    <RegisterDialog />
    <LoginDialog />
    <RequiresAuthDialog name="favorites">
      <template #title>
        <v-card-title class="title">
          <div class="flex">Track your favourites</div>
          <v-icon color="secondary">{{ mdiStar }}</v-icon>
        </v-card-title>
      </template>

      <p>To see the dancers you care most about <strong>featured throughout the app</strong>, you'll need an account first.</p>
    </RequiresAuthDialog>
    <RequiresAuthDialog name="pins">
      <template #title>
        <v-card-title class="title">
          <div class="flex">Pin for easy access</div>
          <v-icon color="secondary">{{ mdiPin }}</v-icon>
        </v-card-title>
      </template>

      <p>To see the competitions you are most interested in <strong>featured more prominently</strong>, you'll need an account first.</p>
    </RequiresAuthDialog>
    <RequiresAuthDialog name="submissions">
      <template #title>
        <v-card-title class="title">
          <div class="flex">Submit your competition</div>
        </v-card-title>
      </template>

      <p>To bring the app to your event, you'll need an account first.</p>
    </RequiresAuthDialog>
  </v-app>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import {
  mdiAccountCircle,
  mdiCalendarMonth,
  mdiClose,
  mdiDotsGrid,
  mdiExitToApp,
  mdiEye,
  mdiFrequentlyAskedQuestions,
  mdiHome,
  mdiMenu,
  mdiNewBox,
  mdiPencil,
  mdiPin,
  mdiCog,
  mdiCogBox,
  mdiSend,
  mdiStar,
} from '@mdi/js';
import { getTitleChunks, getFirstExisting } from '@/helpers/router';
import {
  FIREBASE_ENV,
  idKey,
  db,
  firebase,
} from '@/helpers/firebase';
import RegisterDialog from '@/components/RegisterDialog.vue';
import LoginDialog from '@/components/LoginDialog.vue';
import RequiresAuthDialog from '@/components/RequiresAuthDialog.vue';
import AccountButtons from '@/components/AccountButtons.vue';
import PromptToUpdate from '@/components/PromptToUpdate.vue';
import AppSubmenu from '@/components/AppSubmenu.vue';

export default {
  name: 'app',
  reactiveProvide: {
    name: 'competitionsBundle',
    include: [
      'competitions',
      'competitionsRef',
      'competitionsDataRef',
    ],
  },
  data() {
    return {
      env: FIREBASE_ENV,
      idKey,
      db,

      mdiAccountCircle,
      mdiCalendarMonth,
      mdiClose,
      mdiDotsGrid,
      mdiExitToApp,
      mdiEye,
      mdiFrequentlyAskedQuestions,
      mdiHome,
      mdiMenu,
      mdiNewBox,
      mdiPencil,
      mdiPin,
      mdiCog,
      mdiCogBox,
      mdiSend,
      mdiStar,

      menuVisible: false,
      submenuVisible: false,
      accountVisible: false,

      competitionsRef: undefined,
      competitionsDataRef: undefined,
      versions: undefined,
    };
  },
  computed: {
    ...mapState([
      '$device',
      'me',
    ]),
    ...mapGetters([
      'needsUpdating',
    ]),

    latestVersion() {
      return this.versions?.[this.$device?.platform];
    },

    competitions() {
      return this.competitionsRaw
        .map((competition) => ({
          ...competition,
          $pinned: this.$store.getters.isFavorite('competitions', competition[idKey]),
          $viewed: this.$store.getters.isViewed('competitions', competition[idKey]),
          $relevance: Math.abs(this.$moment().diff(competition.date)),
        }))
        .filter((competition) => competition.listed || this.$store.getters.hasPermission(`competitions/${competition[idKey]}`))
        .sort((a, b) => -this.$moment(a.date).diff(b.date)); // order chronologically
    },

    submenuIsNew: {
      get() {
        return !this.$store.getters.isViewed('ui', 'submenu');
      },
      set(to) {
        return this.$store.commit('setViewed', ['ui', 'submenu', !to]);
      },
    },
  },
  asyncComputed: {
    async title() {
      const titleChunks = await getTitleChunks(this.$route);

      if (titleChunks.length > 3) {
        return titleChunks[titleChunks.length - 3];
      }
      if (titleChunks.length > 2) {
        return titleChunks[titleChunks.length - 2];
      }
      if (this.$route.name === 'competition.info') {
        return titleChunks[0];
      }
      return titleChunks[titleChunks.length - 1];
    },
  },
  watch: {
    me(me) {
      if (me) {
        if (window.$crisp && me.email) {
          window.$crisp.push(['set', 'user:email', me.email]);
        }
      }
    },

    latestVersion(v) {
      this.$store.commit('setLatestVersion', v);
    },

    submenuVisible(submenuVisible) {
      if (this.submenuIsNew) {
        if (submenuVisible) {
          // dismiss after delay when submenu opened
          setTimeout(() => { // @TODO: clearTimeout on close so this doesn't leak
            this.submenuIsNew = false;
          }, 3000);
        } else {
          // dismiss instantly if submenu closed
          this.submenuIsNew = false;
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

      if (this.versions) this.$bind('versions');
      this.$bindAsObject('versions', db.child('versions'));
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
    },

    logout() {
      return firebase.auth().signOut();
    },
  },
  async created() {
    this.loadFirebase();
  },
  mounted() {
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
    PromptToUpdate,
    AppSubmenu,
  },
};
</script>

<style lang="scss">
// extension styling overrides
#crisp-chatbox {
  > div {
    > a {
      right: calc(14px + env(safe-area-inset-right)) !important;
      bottom: calc(14px + env(safe-area-inset-bottom)) !important;
    }
    > div {
      top: env(safe-area-inset-top) !important;
      left: env(safe-area-inset-left) !important;
      right: env(safe-area-inset-right) !important;
      bottom: env(safe-area-inset-bottom) !important;
      height: calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
    }

    body.has-bottom-bar & {
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
  height: 100%;
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

// app-wide custom styling
a {
  &.ext,
  & .ext {
    &::after {
      content: '\2197\00FE0E'; // append \00FE0E to prevent iOS/Android from emojifying the arrow
      margin-left: 0.25em;
      text-decoration: none;
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
.dot-divided {
  > * {
    &:not(:first-child) {
      &::before {
        content: '•';
        display: inline-block;
        margin-left: 0.25em;
        margin-right: 0.25em;
        text-decoration: none;
      }
    }
  }
}
.stripes {
  // make it obvious that we're not using prod data, or are doing some privileged action
  background-image: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px) !important;
}

// app frame
html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
body {
  // for iPhone-X
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);

  background: #000;

  &::before {
    // simulate statusbar-spanning app bar on ios
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: env(safe-area-inset-top);
    background: #1976d2;
  }
}

.v-application {
  &--wrap,
  .v-main__wrap {
    @extend .app-scroll-frame;
  }

  // framework component styling
  .v-application--wrap {
    min-height: calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important; // for iPhone-X
  }
  .v-navigation-drawer {
    &--absolute {
      z-index: 10; // see: https://github.com/vuetifyjs/vuetify/issues/4241
    }
    &__content {
      @extend .app-scroll-frame;

      position: relative;
      margin-top: env(safe-area-inset-top);
      margin-left: env(safe-area-inset-left);
      margin-bottom: env(safe-area-inset-bottom);
    }

    .v-btn.v-btn--absolute {
      top: 0;
      right: 0;
    }
  }
  .v-btn--absolute,
  .v-btn--fixed {
    &.v-btn--top {
      top: calc(16px + env(safe-area-inset-top));
    }
    &.v-btn--left {
      left: calc(16px + env(safe-area-inset-left));
    }
    &.v-btn--right {
      right: calc(16px + env(safe-area-inset-right));
    }
    &.v-btn--bottom {
      bottom: calc(16px + env(safe-area-inset-bottom));
    }
  }
  .v-dialog {
    &--full-height {
      // @TODO: deprecate in favour of using <v-dialog fullscreen />
      &,
      > .v-card,
      .v-stepper,
      .v-stepper__items,
      .v-stepper__content,
      .v-stepper__wrapper,
      .v-tabs,
      .v-window,
      .v-window__container,
      .v-window-item {
        @extend .app-scroll-frame;
      }
      .v-stepper__header,
      .v-tabs-bar {
        flex-shrink: 0;
      }
    }

    &--scrollable > .v-card {
      width: 100%;

      > .v-card__text {
        @extend .app-scroll;
      }
    }
  }
  .v-bottom-navigation.v-item-group {
    flex-shrink: 0;
    justify-content: stretch;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    z-index: 1; // keep above tab contents

    > * {
      flex-shrink: 0;
    }

    // @HACK for safari to horizontally center tabs while allowing overflow-x
    &::before,
    &::after {
      content: ' ';
      flex: auto;
    }
  }
  .v-toolbar {
    z-index: 1; // make shadow cover things beneath

    &__title {
      a {
        color: inherit;
        text-decoration: none;
      }
    }

    .SearchField {
      .v-input__control {
        min-height: 36px;
      }
    }
  }
  .v-subheader {
    flex: none;
    height: auto;
    min-height: 48px;

    .v-btn:not(.v-size--x-small) {
      margin-right: -8px;
    }
  }
  .v-avatar {
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;

    &.primary,
    &.secondary,
    &.grey {
      color: #fff;

      .v-icon {
        color: inherit;
      }
    }

    svg,
    img {
      width: initial;
      height: initial;
      max-width: 100%;
      max-height: 100%;
      border-radius: 0;
    }
  }
  .v-list {
    &.grouped {
      background-color: transparent;

      .v-list-group {
        .v-list-group__header {
          > .v-subheader {
            flex: auto;
            max-width: calc(100% - 48px); // @HACK: to avoid pushing the chevron offscreen
            padding: 0;

            + .v-list-item__icon {
              margin-left: 0;
            }
          }
        }
      }
    }
  }
  .v-card {
    &__title {
      flex-wrap: nowrap;
      word-break: normal;
    }
  }
  .v-input {
    &.theme--dark ::-webkit-calendar-picker-indicator {
        filter: invert(1);
    }
  }
}

// tables
.handsontable {
  color: black; // stay readable when in darkMode

  &[id] {
    height: 100%; // height must also be defined at some point up the chain (e.g. .app-scroll-frame)
    min-height: 240px; // for stacking blades on mobile
    overflow: hidden; // enables HotTable's scrolling
  }

  // subtract 100 from native z-indexes to avoid covering vuetify GUI
  .ht_clone_top {
    z-index: 1;
  }
  .ht_clone_left {
    z-index: 2;
  }
  .ht_clone_top_left_corner,
  .ht_clone_bottom_left_corner {
    z-index: 3;
  }
}

// drag-n-drop
.sortable-handle {
  .v-list-item & {
    order: -1;
    height: 100%;
    margin-left: -16px;
    opacity: 0.5;
    cursor: move;
  }
}
.sortable-chosen,
.sortable-ghost {
  &.v-list-item {
    opacity: 0.5;
    border-top: dashed 2px #ccc;
    border-bottom: dashed 2px #ccc;
  }
  &.v-chip {
    opacity: 0.5;
  }
}
.sortable-drag {
  opacity: 0 !important;
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

    &-group {
      &.v-list-group--active {
        color: inherit !important;
      }
    }
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
