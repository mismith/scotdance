import Vue from 'vue';
import VueFire from 'vuefire';
import VueMaterial from 'vue-material';
import 'vue-material/dist/vue-material.css';
import 'simple-line-icons/css/simple-line-icons.css';

import App from './app';
import router from './router';

import MdSwiper from './components/md-swiper';
import MdSpinnable from './components/md-spinnable';

Vue.config.productionTip = false;

Vue.prototype.$isApp = window.location.protocol === 'file:';

Vue.use(VueFire);
Vue.use(VueMaterial);
Vue.material.registerTheme('default', {
  primary: {
    color: 'blue',
    hue: 600,
  },
});
Vue.component('md-swiper', MdSwiper);
Vue.component('md-spinnable', MdSpinnable);

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  template: '<app />',
  components: {
    App,
  },
});
