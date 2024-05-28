/* eslint-disable no-param-reassign */

import Vue from 'vue';
import Vuex from 'vuex';
import VueLocalStorage from 'vue-localstorage';
import { get } from 'deep-property';
import {
  getField,
  updateField,
} from 'vuex-map-fields';
import {
  firebaseMutations,
  firebaseAction,
} from 'vuexfire';
import compareVersions from 'compare-versions';

import $package from '@/../package.json';
import {
  idKey,
  db,
} from '@/helpers/firebase';

Vue.use(Vuex);
Vue.use(VueLocalStorage, {
  namespace: $package.name,
  bind: true,
});

let viewed = {};
try {
  viewed = JSON.parse(Vue.localStorage.get('viewed')) || {};
} catch (err) {
  // IGNORE
}

export default new Vuex.Store({
  state: {
    $package: {
      $name: 'ScotDance.app',
      ...$package,
    },
    $device: {
      platform: 'web',
    },
    currentVersion: $package.version,
    latestVersion: undefined,

    credentials: {
      email: undefined,
      password: undefined,
    },
    postLoginCallbacks: [],

    meRef: undefined,
    myFavoritesRef: undefined,
    myPermissionsRef: undefined,
    me: undefined,
    myFavorites: undefined,
    myPermissions: undefined,

    viewed,
    allCompetitions: window.sessionStorage?.getItem(`${$package.name}.allCompetitions`) === 'true',

    currentDialog: undefined,
    currentDialogData: undefined,

    clipboard: {
      type: undefined,
      data: undefined,
    },

    helpAvailable: false,
    helpVisible: false,

    featureFlags: undefined,
  },
  getters: {
    getField,

    needsUpdating: (state) => {
      if (state.currentVersion && state.latestVersion) {
        const needsUpdating = compareVersions(state.currentVersion, state.latestVersion) < 0;
        return needsUpdating;
      }
      return false;
    },

    isFavorite: (state) => (type, id) => Boolean(get(state.myFavorites, `${type}.${id}`)),
    favorites: (state) => (type) => get(state.myFavorites, type) || {},

    hasPermission: (state) => (permission) => {
      if (get(state.myPermissions, 'admin') === true) {
        return true;
      }
      return get(state.myPermissions, permission.replace(/\//g, '.')) === true;
    },

    isViewed: (state) => (type, id) => state.viewed
      && state.viewed[type]
      && state.viewed[type].find((item) => item[0] === id),

    getFeatureFlag: (state) => (flagId, defaultValue = false) => {
      return state.featureFlags?.[flagId] || defaultValue;
    },
  },
  mutations: {
    updateField,
    ...firebaseMutations,

    setDevice(state, to) {
      state.$device = to;
    },
    setLatestVersion(state, to) {
      state.latestVersion = to;
    },

    addPostLoginCallback(state, callback) {
      state.postLoginCallbacks.push(callback);
    },

    setViewed(state, [type, id, on = true, max = 5]) {
      if (type && id) {
        Vue.set(state.viewed, type, [
          [id, on && Date.now()],
          ...(state.viewed[type] || []),
        ]
          .filter((v) => v[1]) // remove empties
          .filter((v, i, a) => a.findIndex((vv) => vv[0] === v[0]) === i) // avoid duplicates
          .slice(0, max)); // truncate to prevent leaking
      } else if (type) {
        Vue.set(state.viewed, type, []);
      } else {
        state.viewed = {};
      }
      Vue.localStorage.set('viewed', JSON.stringify(state.viewed));
    },
    setAllCompetitions(state, to) {
      state.allCompetitions = to;

      const key = `${$package.name}.allCompetitions`;
      if (to) {
        window.sessionStorage?.setItem(key, 'true');
      } else {
        window.sessionStorage?.removeItem(key);
      }
    },

    setCurrentDialog(state, to) {
      if (typeof to === 'string') {
        state.currentDialog = to;
        state.currentDialogData = undefined;
      } else {
        const [currentDialog, currentDialogData] = to || [];
        state.currentDialog = currentDialog;
        state.currentDialogData = currentDialogData;
      }
    },

    copy(state, { data, type = 'text/plain' }) {
      state.clipboard = {
        type,
        data,
      };
    },

    setHelpAvailable(state, helpAvailable) {
      state.helpAvailable = helpAvailable;
    },
    setHelpVisible(state, helpVisible) {
      state.helpVisible = helpVisible;
    },
  },
  actions: {
    auth: firebaseAction(({ bindFirebaseRef, state }, { uid, email }) => {
      state.meRef = db.child('users').child(uid);
      state.myFavoritesRef = db.child('users:favorites').child(uid);
      state.myPermissionsRef = db.child('users:permissions').child(uid);

      bindFirebaseRef('me', state.meRef, {
        async readyCallback(meSnap) {
          // await 'me'
          await Vue.nextTick();

          // flush post-login callbacks
          state.postLoginCallbacks.forEach((callback) => callback());
          state.postLoginCallbacks = [];

          // ensure database email is always in sync with actual auth account email address
          const { email: dbEmail } = meSnap.val() || {};
          if (dbEmail !== email) {
            state.meRef.child('email').set(email);
          }
        },
      });
      bindFirebaseRef('myFavorites', state.myFavoritesRef);
      bindFirebaseRef('myPermissions', state.myPermissionsRef);
    }),
    unauth: firebaseAction(({ unbindFirebaseRef, state }) => {
      if (state.me) unbindFirebaseRef('me');
      if (state.myFavorites) unbindFirebaseRef('myFavorites');
      if (state.myPermissions) unbindFirebaseRef('myPermissions');

      state.me = null;
      state.myFavorites = null;
      state.myPermissions = null;

      state.meRef = null;
      state.myFavoritesRef = null;
      state.myPermissionsRef = null;
    }),

    toggleFavoriteDancer({ state, commit }, dancer) {
      const setFavorite = (on) => state.myFavoritesRef
        .child('dancers')
        .child(dancer[idKey])
        .set(on ? (dancer.$name || true) : null);

      if (state.myFavoritesRef) {
        return setFavorite(!dancer.$favorite);
      }

      // 'store' dancer for favoriting post-auth...
      commit('addPostLoginCallback', () => {
        setFavorite(true);
      });

      // ...while opening dialog to inform user about favorites functionality
      return commit('setCurrentDialog', 'favorites');
    },
    togglePinnedCompetition({ state, commit }, competition) {
      const setPinned = (to) => state.myFavoritesRef
        .child('competitions')
        .child(competition[idKey])
        .set(to || null);

      if (state.myFavoritesRef) {
        return setPinned(!competition.$pinned);
      }

      // 'store' competition for pinning post-auth...
      commit('addPostLoginCallback', () => {
        setPinned(true);
      });

      // ...while opening dialog to inform user about favorites functionality
      return commit('setCurrentDialog', 'pins');
    },

    help({ state, commit }, set = undefined) {
      if (window.$crisp && state.helpAvailable) {
        if (set === false || (set === undefined && state.helpVisible)) {
          window.$crisp.push(['do', 'chat:hide']);
          commit('setHelpVisible', false);
          return false;
        }
        if (set === true || (set === undefined && !state.helpVisible)) {
          window.$crisp.push(['do', 'chat:show']);
          commit('setHelpVisible', true);
          window.$crisp.push(['do', 'chat:open']);
          return true;
        }
      }
      return undefined;
    },

    bindFeatureFlags: firebaseAction(({ bindFirebaseRef }) => {
      bindFirebaseRef('featureFlags', db.child('featureFlags'));
    }),
  },
});
