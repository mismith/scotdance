<template>
  <md-app id="app" class="md-scroll-frame md-scroll">
    <md-app-toolbar class="md-primary" style="flex-wrap: nowrap;">
      <md-button class="md-icon-button" @click="menuVisible = !menuVisible">
        <md-icon>menu</md-icon>
      </md-button>

      <h2 class="md-title">{{ title }}</h2>

      <!--<span class="md-flex"></span>

      <md-button class="md-icon-button">
        <md-icon>search</md-icon>
      </md-button>-->
    </md-app-toolbar>

    <md-app-drawer :md-active.sync="menuVisible">
      <md-toolbar class="md-primary md-large md-account-header">
        <div class="bg" style="background-image: url('static/img/touchicon.png');"></div>
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
          <md-list-item @click="toggleAccount()" :class="{toggled: accountToggled}">
            <div class="md-list-item-text">
              <span>{{ me.email }}</span>
            </div>
            <md-button class="md-icon-button md-list-action" @click.stop="toggleAccount()">
              <md-icon>arrow_drop_down</md-icon>
            </md-button>
          </md-list-item>
        </md-list>
      </md-toolbar>

      <div class="md-scroll-frame md-scroll">
        <md-list v-if="accountToggled" class="md-dense animate-in">
          <md-subheader>Account</md-subheader>

          <md-list-item
            @click="$router.push('/profile'); menuVisible = false; accountToggled = false;"
          >
            <md-icon>account_circle</md-icon>
            <span class="md-list-item-text">My Profile</span>
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
              @click="$router.push(`/competitions/${db.push().key}/admin`); menuVisible = false;"
              class="md-icon-button"
            >
              <md-icon>add</md-icon>
            </md-button>
          </md-subheader>

          <competition-list-item
            v-for="competition in relevantCompetitions"
            :key="competition[idKey]"
            :competition="competition"
            @click="$router.push(`/competitions/${competition[idKey]}`); menuVisible = false;"
            @admin-click="menuVisible = false;"
          />

          <footer v-if="competitions.length && competitions.length !== relevantCompetitions.length" style="text-align: center;">
            <md-button @click="$router.push(`/competitions`); menuVisible = false;">
              See {{ competitions.length - relevantCompetitions.length }} More
            </md-button>
          </footer>
        </md-list>

        <md-list v-if="!accountToggled" class="md-dense">
          <md-subheader>Links</md-subheader>

          <md-list-item
            @click="$router.push(`/`); menuVisible = false;"
          >
            <md-icon>home</md-icon>
            <span class="md-list-item-text">App Home</span>
          </md-list-item>
        </md-list>
      </div>
    </md-app-drawer>

    <md-app-content id="main" class="md-scroll-frame md-scroll">
      <router-view />
    </md-app-content>

  </md-app>
</template>

<script>
import moment from 'moment-mini';
import {
  mapState,
} from 'vuex';
import {
  getTitleChunks,
} from '@/helpers/router';
import {
  idKey,
  db,
  firebase,
} from '@/helpers/firebase';
import AccountButtons from '@/components/account-buttons';
import CompetitionListItem from '@/components/competition-list-item';

export default {
  name: 'app',
  data() {
    return {
      idKey,
      db,

      accountToggled: false,
      menuVisible: false,
    };
  },
  firebase: {
    competitionsRaw: db.child('competitions'),
  },
  computed: {
    ...mapState([
      'me',
    ]),

    competitions() {
      return this.competitionsRaw.map(competition => ({
        ...competition,
        $favorite: this.$store.getters.isFavorite('competitions', competition[idKey]),
      }));
    },

    relevantCompetitions() {
      return this.competitions
        .filter((competition) => { // only show upcoming or up to 7 day old events
          if (competition.date && moment(competition.date).isAfter(moment().subtract(7, 'days'))) {
            return true;
          }
          return false;
        })
        .sort((a, b) => moment(a.date).diff(b.date)) // order chronologically
        .slice(0, 10); // limit to 10 max
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
  methods: {
    toggleAccount(accountToggled = undefined) {
      this.accountToggled = accountToggled !== undefined ? accountToggled : !this.accountToggled;
    },
    logout() {
      return firebase.auth().signOut();
    },
  },
  components: {
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
));
@import "~vue-material/dist/theme/all";

$simple-line-font-path: "~simple-line-icons/fonts/";
@import "~simple-line-icons/scss/simple-line-icons";

// element overrides
a[target="_blank"] {
  &:after {
    content: "\2197";
    margin-left: 0.25em;
  }
}

// app-wide helpers
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
.md-subheader {
  > div {
    flex: auto;

    + * {
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

// app-wide md-component styling
.md-list {
  flex-shrink: 0;

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
      .md-list-item-content {
        .md-subheader:not(.md-list-item) {
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
    &.active {
      .md-list-item-container {
        color: var(--md-theme-default-primary) !important;
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
  &.md-list-card {
    padding: 0;
    margin: 8px 16px;
    box-shadow: 0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12); // .md-elevation-1
  }
  &.md-list-cards {
    background-color: initial;
    padding: 0;

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

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.md-toolbar-nowrap {
    flex-wrap: nowrap;
  }
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

.md-dialog {
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
}

.swiper-slide {
  @extend .md-scroll-frame;
}

.md-padding {
  padding: 12px 16px;
}

// component styles
.validation-message {
  color: var(--md-theme-default-accent) !important;
  margin-top: 16px;
}

.md-app-drawer {
  display: flex;
  flex-direction: column;
}

.login-dialog,
.register-dialog,
.remove-user-dialog {
  .md-dialog-actions {
    display: flex;
    justify-content: space-between;
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

.md-account-header {
  padding: 0;

  .bg {
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

  .account-buttons {
    align-items: center;
    margin: auto;

    .md-button {
      margin-left: 0;
      margin-right: 0;
    }
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
