import Vue from 'vue';
import VueFire from 'vuefire';
import VueMaterial from 'vue-material';
import 'vue-material/dist/vue-material.css';
import VueAwesomeSwiper from 'vue-awesome-swiper';
import 'swiper/dist/css/swiper.css';
import 'simple-line-icons/css/simple-line-icons.css';
import AsyncComputed from 'vue-async-computed';

import {
  getTitleChunks,
} from '@/helpers/router';

import App from './app';
import router from './router';

import MdSpinnable from './components/md-spinnable';

Vue.config.productionTip = false;

Vue.use(VueFire);
Vue.use(VueMaterial);
Vue.component('md-spinnable', MdSpinnable);
Vue.use(VueAwesomeSwiper);
Vue.use(AsyncComputed);

router.beforeEach(async (to, from, next) => {
  const titleChunks = await getTitleChunks(to);

  document.title = titleChunks.reverse().join(' • ');

  next();
});

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  template: '<app />',
  components: {
    App,
  },
});
