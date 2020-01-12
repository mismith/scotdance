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
      <v-btn icon @click="menuVisible = !menuVisible">
        <v-badge v-model="needsUpdating" overlap color="secondary" class="blip">
          <template #badge>&nbsp;</template>
          <v-icon>mdi-menu</v-icon>
        </v-badge>
      </v-btn>

      <v-toolbar-title>
        <router-link :to="{ name: 'competitions' }">{{ title }}</router-link>
      </v-toolbar-title>

      <v-spacer />

      <v-btn
        icon
        v-if="$route.params.competitionId && $store.getters.hasPermission(`competitions/${$route.params.competitionId}`) && getMirrorRoute()"
        :to="getMirrorRoute()"
      >
        <v-icon>mdi-{{ /^competition.admin/.test($route.name) ? 'eye' : 'pencil' }}</v-icon>
      </v-btn>

      <v-menu offset-y left>
        <template #activator="{ on }">
          <v-btn icon v-on="on">
            <v-icon>mdi-help-circle</v-icon>
          </v-btn>
        </template>

        <v-list>
          <v-list-item :to="{ name: 'home', query: { at: 'about' } }" exact>
            <v-list-item-title>About</v-list-item-title>
          </v-list-item>
          <v-list-item :to="{ name: 'home', query: { at: 'faq' } }" exact>
            <v-list-item-title>FAQs</v-list-item-title>
          </v-list-item>
          <template v-if="$store.state.helpAvailable">
            <v-divider />
            <v-list-item @click="help(true)">
              <v-list-item-title>Feedback</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="$store.state.helpVisible" @click="help(false)">
              <v-list-item-title class="error--text">Hide Live Chat</v-list-item-title>
            </v-list-item>
          </template>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer
      v-model="menuVisible"
      app
      touchless
      :width="320"
      class="app-scroll-frame"
    >
      <header class="account-header primary flex-none">
        <div class="account-bg"></div>
        <AccountButtons v-if="!me" class="pa-4" />
        <template v-else>
          <v-list three-line>
            <v-list-item class="has-avatar">
              <v-avatar :size="64">
                <Gravatar :user="me" />
              </v-avatar>
            </v-list-item>
          </v-list>
          <v-list dark>
            <v-list-group v-model="accountToggled">
              <template #activator>
                <v-list-item-content>
                  <v-list-item-title>
                    {{ me.displayName || me.email || 'Account' }}
                  </v-list-item-title>
                </v-list-item-content>
              </template>
            </v-list-group>
          </v-list>
        </template>

        <RegisterDialog />
        <LoginDialog />
        <RequiresAuthDialog name="favorites">
          <template #title>
            <v-card-title class="title">
              Track your favourites
              <v-icon color="secondary">mdi-star</v-icon>
            </v-card-title>
          </template>

          <p>To see the dancers you care most about <strong>featured throughout the app</strong>, you'll need an account first.</p>
          <p>Fortunately, it takes <strong>less than 30 seconds</strong>—all you need is an email and password.</p>
        </RequiresAuthDialog>
        <RequiresAuthDialog name="submissions">
          <template #title>
            <v-card-title class="title">
              <div class="flex">Submit your competition</div>
            </v-card-title>
          </template>

          <p>To bring the app to your event, you'll need an account first.</p>
          <p>Fortunately, it takes <strong>less than 30 seconds</strong>—all you need is an email and password.</p>
        </RequiresAuthDialog>

        <v-btn icon absolute color="white" class="ma-2" @click="menuVisible = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </header>

      <div class="app-scroll-frame app-scroll">
        <template v-if="accountToggled">
          <v-list>
            <v-subheader>Account</v-subheader>

            <v-list-item :to="{ name: 'profile' }" @click="closeMenu()">
              <v-list-item-avatar>
                <v-icon>mdi-account-circle</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>My Profile</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>

          <v-spacer />
          <v-divider />
          <v-list>
            <v-list-item @click="logout().then(toggleAccount)">
              <v-list-item-avatar>
                <v-icon>mdi-exit-to-app</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>Logout</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </template>

        <template v-else>
          <v-list two-line>
            <v-subheader>
              <router-link
                :to="{ name: 'competitions' }"
                class="flex"
                style="color: inherit; text-decoration: none;"
              >
                Competitions
              </router-link>

              <v-btn :to="{ name: 'competitions.submit' }" icon @click="closeMenu()">
                <v-icon>mdi-plus</v-icon>
              </v-btn>
            </v-subheader>

            <CompetitionListItem
              v-for="competition in relevantCompetitions"
              :key="competition[idKey]"
              :competition="competition"
              :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }"
              @click="closeMenu()"
            />

            <v-list-item v-if="!relevantCompetitions.length" class="empty">
              <v-list-item-avatar>
                <v-icon>mdi-close</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                No competitions found.
              </v-list-item-content>
            </v-list-item>

            <footer
              v-if="competitions.length && competitions.length !== relevantCompetitions.length"
              class="d-flex justify-center pa-3"
            >
              <v-btn text color="primary" exact :to="{ name: 'competitions' }" @click="closeMenu()">
                View {{ competitions.length - relevantCompetitions.length }} More
              </v-btn>
            </footer>
          </v-list>

          <v-spacer />
          <v-divider />
          <v-list>
            <v-subheader>Links</v-subheader>

            <PromptToUpdate v-if="needsUpdating">
              <template #activator="{ on }">
                <v-list-item v-on="on" color="secondary" class="v-list-item--active">
                  <v-list-item-avatar>
                    <v-icon color="secondary">mdi-new-box</v-icon>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    <v-list-item-title>Update App</v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
              </template>
            </PromptToUpdate>

            <v-list-item to="/" exact @click="closeMenu()">
              <v-list-item-avatar>
                <v-icon>mdi-home</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>App Home</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
            <v-list-item
              :to="{ name: 'settings' }"
              @click="closeMenu()"
            >
              <v-list-item-avatar>
                <v-icon>mdi-settings</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>App Settings</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
            <v-list-item
              v-if="$store.getters.hasPermission('admin')"
              :to="{ name: 'admin.info' }"
              @click="closeMenu()"
            >
              <v-list-item-avatar>
                <v-icon>mdi-settings-box</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>App Admin</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </template>
      </div>
    </v-navigation-drawer>

    <v-content id="main" class="app-scroll-frame">
      <router-view
        v-if="$store.state.me !== undefined"
        v-bind="{
          competitions,
          competitionsRef,
          competitionsDataRef,
        }"
      />
      <div v-else class="app-scroll-frame">
        <Spinner />
      </div>
    </v-content>
  </v-app>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { getTitleChunks, getFirstExisting, checkForUpdates } from '@/helpers/router';
import { FIREBASE_ENV, idKey, db, firebase } from '@/helpers/firebase';
import RegisterDialog from '@/components/RegisterDialog.vue';
import LoginDialog from '@/components/LoginDialog.vue';
import RequiresAuthDialog from '@/components/RequiresAuthDialog.vue';
import AccountButtons from '@/components/AccountButtons.vue';
import CompetitionListItem from '@/components/CompetitionListItem.vue';
import PromptToUpdate from '@/components/PromptToUpdate.vue';

export default {
  name: 'app',
  data() {
    return {
      env: FIREBASE_ENV,
      idKey,
      db,

      accountToggled: false,
      menuVisible: false,

      competitionsRef: undefined,
      competitionsDataRef: undefined,

      needsUpdating: false,
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
          // $favorite: this.$store.getters.isFavorite('competitions', competition[idKey]),
        }))
        .filter(competition => competition.listed || this.$store.getters.hasPermission(`competitions/${competition[idKey]}`))
        .sort((a, b) => -this.$moment(a.date).diff(b.date)); // order chronologically
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

    logout() {
      return firebase.auth().signOut();
    },
  },
  async created() {
    this.loadFirebase();

    this.needsUpdating = await checkForUpdates();
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
    CompetitionListItem,
    PromptToUpdate,
  },
};
</script>

<style lang="scss">
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
  > span {
    &:not(:last-child) {
      &::after {
        content: '•';
        display: inline-block;
        margin-left: 0.25em;
        margin-right: 0.25em;
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
}

.v-application {
  &--wrap,
  .v-content__wrap {
    @extend .app-scroll-frame;
  }

  // framework component styling
  .v-application--wrap {
    min-height: calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important; // for iPhone-X
  }
  .v-navigation-drawer {
    max-height: calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom)); // for iPhone-X
    border-left: env(safe-area-inset-left) solid #000;

    &--absolute {
      z-index: 10; // see: https://github.com/vuetifyjs/vuetify/issues/4241
    }
    &__content {
      @extend .app-scroll-frame;
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
    justify-content: unset;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;

    // can't use justify-content: center; because then overflowing clips
    > * {
      &:first-child {
        margin-left: auto;
      }
      &:last-child {
        margin-right: auto;
      }
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
  }
  .v-subheader {
    flex: none;

    .v-btn {
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
          .v-subheader {
            flex: auto;
            padding: 0;
          }
        }
      }
    }
  }
  .v-badge {
    &.blip {
      .v-badge__badge {
        min-width: 12px;
        height: 12px;
        font-size: 0;
      }
    }
  }
}

// tables
.handsontable {
  color: black; // stay reable when in darkMode

  &:not(.handsontableEditor) {
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
  .v-btn.v-btn--absolute {
    top: 0;
    right: 0;
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
