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
  },
  mutations: {
    ...firebaseMutations,
  },
  actions: {
    auth: firebaseAction(({ bindFirebaseRef }, { meRef }) => {
      bindFirebaseRef('me', meRef);
    }),
    unauth: firebaseAction(({ unbindFirebaseRef, state }) => {
      unbindFirebaseRef('me');
      state.me = null;
    }),
  },
});
