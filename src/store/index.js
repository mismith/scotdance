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
  db,
} from '@/helpers/firebase';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    $package: {},
    $device: {
      platform: 'Web',
    },

    credentials: {
      email: undefined,
      password: undefined,
    },
    me: undefined,
    myFavorites: undefined,
    myPermissions: undefined,
    postLoginCallbacks: [],

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
      return state.myFavorites && state.myFavorites[type] && !!state.myFavorites[type][id];
    },
    hasPermission(state, ...keys) {
      if (get(state.myPermissions, 'admin')) {
        return true;
      }
      return !!get(state.myPermissions, keys.join('.'));
    },
  },
  mutations: {
    updateField,
    ...firebaseMutations,

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
      bindFirebaseRef('me', db.child('users').child(uid), {
        async readyCallback() {
          // await this.me
          await Vue.nextTick();

          // flush post-login callbacks
          state.postLoginCallbacks.forEach(callback => callback());
          state.postLoginCallbacks = [];
        },
      });
      bindFirebaseRef('myFavorites', db.child('users:favorites').child(uid));
      bindFirebaseRef('myPermissions', db.child('users:permissions').child(uid));
    }),
    unauth: firebaseAction(({ unbindFirebaseRef, state }) => {
      unbindFirebaseRef('me');
      state.me = null;

      unbindFirebaseRef('myFavorites');
      state.myFavorites = null;

      unbindFirebaseRef('myPermissions');
      state.myPermissions = null;
    }),

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
