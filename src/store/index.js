import Vue from 'vue';
import Vuex from 'vuex';
import { get } from 'deep-property';
import {
  getField,
  updateField,
} from 'vuex-map-fields';
import {
  firebaseMutations,
  firebaseAction,
} from 'vuexfire';
import {
  idKey,
  db,
} from '@/helpers/firebase';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    $package: {},
    $device: {
      platform: 'Web',
    },

    loading: true,

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

    currentDialog: undefined,
    currentDialogData: undefined,

    clipboard: {
      type: undefined,
      data: undefined,
    },

    helpVisible: false,
  },
  getters: {
    getField,

    isFavorite: state => (type, id) => {
      return !!get(state.myFavorites, `${type}.${id}`);
    },
    hasPermission: state => (...keys) => {
      if (get(state.myPermissions, 'admin')) {
        return true;
      }
      return !!get(state.myPermissions, keys.join('.'));
    },
  },
  mutations: {
    updateField,
    ...firebaseMutations,

    setLoading(state, to) {
      state.loading = to;
    },

    setPackage(state, to) {
      state.$package = to;
    },
    setDevice(state, to) {
      state.$device = to;
    },

    addPostLoginCallback(state, callback) {
      state.postLoginCallbacks.push(callback);
    },

    setCurrentDialog(state, to) {
      if (typeof to === 'string') {
        state.currentDialog = to;
        state.currentDialogData = undefined;
      } else {
        state.currentDialog = to[0];
        state.currentDialogData = to[1];
      }
    },

    copy(state, { data, type = 'text/plain' }) {
      state.clipboard = {
        type,
        data,
      };
    },

    setHelpVisible(state, helpVisible) {
      state.helpVisible = helpVisible;
    },
  },
  actions: {
    auth: firebaseAction(({ bindFirebaseRef, state }, { uid }) => {
      state.meRef = db.child('users').child(uid);
      state.myFavoritesRef = db.child('users:favorites').child(uid);
      state.myPermissionsRef = db.child('users:permissions').child(uid);
      bindFirebaseRef('me', state.meRef, {
        async readyCallback() {
          // await 'me'
          await Vue.nextTick();

          // flush post-login callbacks
          state.postLoginCallbacks.forEach(callback => callback());
          state.postLoginCallbacks = [];
        },
      });
      bindFirebaseRef('myFavorites', state.myFavoritesRef);
      bindFirebaseRef('myPermissions', state.myPermissionsRef);
    }),
    unauth: firebaseAction(({ unbindFirebaseRef, state }) => {
      unbindFirebaseRef('me');
      unbindFirebaseRef('myFavorites');
      unbindFirebaseRef('myPermissions');

      state.me = null;
      state.myFavorites = null;
      state.myPermissions = null;

      state.meRef = null;
      state.myFavoritesRef = null;
      state.myPermissionsRef = null;
    }),

    toggleFavoriteDancer({ state, commit }, dancer) {
      const setFavorite = to => state.myFavoritesRef
        .child('dancers')
        .child(dancer[idKey])
        .set(to || null);

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
    help({ state, commit }, set = undefined) {
      if (window.$crisp) {
        if (set === false || (set === undefined && state.helpVisible)) {
          window.$crisp.push(['do', 'chat:hide']);
          commit('setHelpVisible', false);
        } else if (set === true || (set === undefined && !state.helpVisible)) {
          window.$crisp.push(['do', 'chat:show']);
          commit('setHelpVisible', true);
          window.$crisp.push(['do', 'chat:open']);
        }
      }
    },
  },
});
