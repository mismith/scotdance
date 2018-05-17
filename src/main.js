import Vue from 'vue';
import VueFire from 'vuefire';
import VueMaterial from 'vue-material';
import 'vue-material/dist/vue-material.css';
import VueAwesomeSwiper from 'vue-awesome-swiper';
import 'swiper/dist/css/swiper.css';
import VueAsyncComputed from 'vue-async-computed';

import {
  firebase,
  db,
} from '@/helpers/firebase';
import {
  getTitleChunks,
} from '@/helpers/router';

import App from './app';
import router from './router';
import store from './store';

import MdSpinnable from './components/md-spinnable';

Vue.config.productionTip = false;

// cordova
if (window.location.protocol === 'file:') {
  Vue.prototype.isApp = true;
  const cordovaScript = document.createElement('script');
  cordovaScript.setAttribute('type', 'text/javascript');
  cordovaScript.setAttribute('src', 'cordova.js');
  document.body.appendChild(cordovaScript);
}

Vue.use(VueFire);
Vue.use(VueMaterial);
Vue.component('md-spinnable', MdSpinnable);
Vue.use(VueAwesomeSwiper);
Vue.use(VueAsyncComputed);

// monitor user auth
firebase.auth().onAuthStateChanged((me) => {
  if (me) {
    const meRef = db.child('users').child(me.uid);
    const myFavoritesRef = db.child('users:favorites').child(me.uid);
    store.dispatch('auth', { meRef, myFavoritesRef });
  } else if (store.state.me) {
    store.dispatch('unauth');
  } else {
    store.state.me = null;
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
