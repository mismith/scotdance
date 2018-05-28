import Vue from 'vue';
import Vuex from 'vuex';
import {
  firebaseMutations,
  firebaseAction,
} from 'vuexfire';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    me: undefined,
    myFavorites: undefined,

    favoritesDialogOpen: false,
    registerDialogOpen: false,
    loginDialogOpen: false,

    clipboard: {
      type: undefined,
      data: undefined,
    },
  },
  getters: {
    isFavorite: state => (type, id) => {
      return state.myFavorites && state.myFavorites[type] && !!state.myFavorites[type][id];
    },
  },
  mutations: {
    ...firebaseMutations,

    setFavoritesDialogOpen(state, to) {
      state.favoritesDialogOpen = to;
    },
    setRegisterDialogOpen(state, to) {
      state.registerDialogOpen = to;
      if (to) {
        state.loginDialogOpen = false;
        state.favoritesDialogOpen = false;
      }
    },
    setLoginDialogOpen(state, to) {
      state.loginDialogOpen = to;
      if (to) {
        state.registerDialogOpen = false;
        state.favoritesDialogOpen = false;
      }
    },

    copy(state, { data, type = 'text/plain' }) {
      state.clipboard = {
        type,
        data,
      };
    },
  },
  actions: {
    auth: firebaseAction(({ bindFirebaseRef }, { meRef, myFavoritesRef }) => {
      bindFirebaseRef('me', meRef);
      bindFirebaseRef('myFavorites', myFavoritesRef);
    }),
    unauth: firebaseAction(({ unbindFirebaseRef, state }) => {
      unbindFirebaseRef('me');
      state.me = null;

      unbindFirebaseRef('myFavorites');
      state.myFavorites = null;
    }),

    help() {
      if (window.$crisp) {
        window.$crisp.push(['do', 'chat:show']);
        window.$crisp.push(['do', 'chat:open']);
      }
    },
  },
});
