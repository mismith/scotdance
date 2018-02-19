import Vue from 'vue';
import VueFire from 'vuefire';
import VueMaterial from 'vue-material';
import 'vue-material/dist/vue-material.css';
import VueAwesomeSwiper from 'vue-awesome-swiper';
import 'swiper/dist/css/swiper.css';
import 'simple-line-icons/css/simple-line-icons.css';
import AsyncComputed from 'vue-async-computed';

import {
  firebase,
} from '@/helpers/firebase';
import {
  getTitleChunks,
} from '@/helpers/router';

import App from './app';
import router from './router';
import store from './store';

import MdSpinnable from './components/md-spinnable';

Vue.config.productionTip = false;

Vue.use(VueFire);
Vue.use(VueMaterial);
Vue.component('md-spinnable', MdSpinnable);
Vue.use(VueAwesomeSwiper);
Vue.use(AsyncComputed);

// monitor user auth
firebase.auth().onAuthStateChanged((me) => {
  if (me) {
    const meRef = firebase.database().ref('users').child(me.uid);
    store.dispatch('auth', { meRef });
  } else if (store.state.me) {
    store.dispatch('unauth');
  }
});

// set page title
router.beforeEach(async (to, from, next) => {
  const titleChunks = await getTitleChunks(to);

  document.title = titleChunks.reverse().join(' • ');

  next();
});

// eslint-disable-next-line no-new
new Vue({
  el: '#app',
  router,
  store,
  template: '<app />',
  components: {
    App,
  },
});
