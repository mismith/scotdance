import Vue from 'vue';
import VueMaterial from 'vue-material';
import 'vue-material/dist/vue-material.css';

import App from './app';
import router from './router';

Vue.config.productionTip = false;
Vue.use(VueMaterial);
Vue.material.registerTheme('default', {
  primary: {
    color: 'blue',
    hue: 600,
  },
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
