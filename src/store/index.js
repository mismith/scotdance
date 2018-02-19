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
  },
  getters: {
    isFavorite: state => (type, id) => {
      return state.myFavorites && state.myFavorites[type] && !!state.myFavorites[type][id];
    },
  },
  mutations: {
    ...firebaseMutations,
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
  },
});
