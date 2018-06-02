import Vue from 'vue';
import Vuex from 'vuex';
import {
  firebaseMutations,
  firebaseAction,
} from 'vuexfire';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    $package: {},
    $device: {
      platform: 'Web',
    },

    me: undefined,
    myFavorites: undefined,
    postLoginCallbacks: [],

    dialogOpen: undefined,

    clipboard: {
      type: undefined,
      data: undefined,
    },

    helpVisible: false,
  },
  getters: {
    isFavorite: state => (type, id) => {
      return state.myFavorites && state.myFavorites[type] && !!state.myFavorites[type][id];
    },
  },
  mutations: {
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

    setDialogOpen(state, to) {
      state.dialogOpen = to;
    },

    copy(state, { data, type = 'text/plain' }) {
      state.clipboard = {
        type,
        data,
      };
    },
  },
  actions: {
    auth: firebaseAction(({ bindFirebaseRef, state }, { meRef, myFavoritesRef }) => {
      bindFirebaseRef('me', meRef, {
        readyCallback() {
          // flush post-login callbacks
          state.postLoginCallbacks.forEach(callback => callback());
          state.postLoginCallbacks = [];
        },
      });
      bindFirebaseRef('myFavorites', myFavoritesRef);
    }),
    unauth: firebaseAction(({ unbindFirebaseRef, state }) => {
      unbindFirebaseRef('me');
      state.me = null;

      unbindFirebaseRef('myFavorites');
      state.myFavorites = null;
    }),

    help({ state }, set = undefined) {
      if (window.$crisp) {
        if (set === false || (set === undefined && state.helpVisible)) {
          window.$crisp.push(['do', 'chat:hide']);
          state.helpVisible = false;
        } else if (set === true || (set === undefined && !state.helpVisible)) {
          window.$crisp.push(['do', 'chat:show']);
          window.$crisp.push(['do', 'chat:open']);
          state.helpVisible = true;
        }
      }
    },
  },
});
