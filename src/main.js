import Vue from 'vue';
import VueFire from 'vuefire';
import VueAsyncComputed from 'vue-async-computed';
import VueBodyClass from 'vue-body-class';
import VueLocalStorage from 'vue-localstorage';
import VueScrollTo from 'vue-scrollto';
import { scroller } from 'vue-scrollto/src/scrollTo';
import moment from 'moment-mini';
import 'typeface-roboto/index.css';
import 'material-design-icons-iconfont/dist/material-design-icons.css';

import { firebase } from '@/helpers/firebase';
import { getTitleChunks } from '@/helpers/router';

import App from '@/App.vue';
import router from '@/router';
import store from '@/store';

import DialogCard from '@/components/DialogCard.vue';
import Spinner from '@/components/Spinner.vue';
import EmptyState from '@/components/EmptyState.vue';
import Blades from '@/components/Blades.vue';
import Blade from '@/components/Blade.vue';
import Gravatar from '@/components/Gravatar.vue';

import './plugins/vuetify';
import $package from '../package.json';

// disable (amongst other things) vue-localstoreage verbose logging
Vue.config.silent = true;

// libs
Vue.prototype.$moment = moment;
Vue.use(VueFire);
Vue.component('DialogCard', DialogCard);
Vue.component('EmptyState', EmptyState);
Vue.component('Gravatar', Gravatar);
Vue.component('Spinner', Spinner);
Vue.component('Blades', Blades);
Vue.component('Blade', Blade);
Vue.use(VueAsyncComputed);
Vue.use(VueBodyClass, router);
Vue.use(VueLocalStorage, {
  bind: true,
  namespace: $package.name,
});
Vue.use(VueScrollTo);

const $scrollAll = (element, options = {}) => {
  const containers = options.container ? [options.container] : document.querySelectorAll('.app-scroll:not(.persist-scroll)');
  Array.from(containers).forEach((container) => {
    const scrollTo = scroller();
    scrollTo(element, {
      container,
      ...options,
      onStart: (...args) => options.onStart && options.onStart(container, ...args),
      onCancel: (...args) => options.onCancel && options.onCancel(container, ...args),
      onDone: (...args) => options.onDone && options.onDone(container, ...args),
    });
  });
};
Vue.prototype.$scrollAll = $scrollAll;

(() => {
  // restore scroll positions (can't use vue-router native because of flexbox app-frame)
  const namespace = 'persist-scroll';
  Vue.localStorage.addProperty(namespace, Object, {});
  const storage = Vue.localStorage.get(namespace, {});
  let onScroll;
  const rebind = (el) => {
    if (onScroll) {
      el.addEventListener('scroll', onScroll);
      el.classList.add(namespace);
    }
  };
  const unbind = (el) => {
    if (onScroll) {
      el.removeEventListener('scroll', onScroll);
      el.classList.remove(namespace);
    }
  };
  const restore = (el, { value: key }) => {
    const value = Number.parseFloat(storage[key]);
    setTimeout(() => {
      el.scrollTop = value; // eslint-disable-line no-param-reassign
    });
  };

  Vue.directive(namespace, {
    bind(el, { value: key }) {
      onScroll = () => {
        const value = el.scrollTop;
        storage[key] = value;
        Vue.localStorage.set(namespace, storage);
      };
      rebind(el);
    },
    inserted: restore,
    update: restore,
    componentUpdated: restore,
    unbind,
  });
})();

// app / devices
store.commit('setPackage', {
  $name: 'ScotDance.app',
  ...$package,
});
Vue.prototype.isApp = window.location.protocol === 'file:';
if (Vue.prototype.isApp) {
  // allow loading cordova plugins
  const cordovaScript = document.createElement('script');
  cordovaScript.setAttribute('type', 'text/javascript');
  cordovaScript.setAttribute('src', 'cordova.js');
  document.body.appendChild(cordovaScript);

  // once cordova plugins are ready
  document.addEventListener('deviceready', () => {
    window.navigator.splashscreen.hide();
    window.StatusBar.show();

    if (window.device) store.commit('setDevice', window.device);
  });

  // scroll to top on status bar tap
  window.addEventListener('statusTap', () => {
    // stop any lingering user-initiated scroll/rubber-banding
    const disableScrollability = (container) => {
      container.style.overflow = 'hidden'; // eslint-disable-line no-param-reassign
    };
    const restoreScrollability = (container) => {
      container.style.overflow = ''; // eslint-disable-line no-param-reassign
    };

    $scrollAll(document.body, {
      onStart: disableScrollability,
      onCancel: restoreScrollability,
      onDone: restoreScrollability,
    });
  });
}

// monitor user auth
firebase.auth().onAuthStateChanged((me) => {
  if (me) {
    store.dispatch('auth', me);
  } else {
    store.dispatch('unauth');
  }
});

// router
Vue.localStorage.addProperty('routeInfo', Object, {});
router.beforeEach(async (to, from, next) => {
  // restore last route (e.g. when re-opening a force-quit app)
  const routeInfo = Vue.localStorage.get('routeInfo', {});
  const routeToRestore = routeInfo.$current;
  if (!from.name && to.name === 'home' && routeToRestore !== 'home') {
    return next({
      name: routeToRestore,
      ...routeInfo[routeToRestore],
    });
  }

  // restore to previous params for competition routes, if necessary & possible
  if (to.params.competitionId && to.name !== from.name) {
    const storedRoute = routeInfo[to.name];
    if (storedRoute && storedRoute.params.competitionId === to.params.competitionId) {
      // same competition, so consider restoring a tab's params
      if (Object.keys(to.params).length === 1 && Object.keys(storedRoute.params).length > 1) {
        // loading root of tab, and have non-root params stored, so restore params
        return next({
          name: to.name,
          ...storedRoute,
        });
      }
    }
  }

  // set page title
  const titleChunks = await getTitleChunks(to);
  document.title = titleChunks.reverse().join(' • ');

  return next();
});
router.afterEach((to) => {
  // store route/tab states for restoring (e.g. on app re-open)
  const routeInfo = Vue.localStorage.get('routeInfo', {});
  routeInfo.$current = to.name;
  routeInfo[to.name] = {
    params: { // clone so mutations don't have side-effects
      ...to.params,
    },
  };
  Vue.localStorage.set('routeInfo', routeInfo);
});

// hide by default (e.g. until navbar help icon is clicked)
if (window.$crisp) {
  window.$crisp.push(['do', 'chat:hide']);
  window.$crisp.push(['on', 'message:received', () => {
    if (window.$crisp.is('chat:hidden')) {
      window.$crisp.push(['do', 'chat:show']);
      store.commit('setHelpVisible', true);
    }
  }]);
}

new Vue({
  router,
  store,
  render: h => h(App),
  computed: {
    currentTab() {
      return this.$route.params.tab || this.$route.name.split('.').slice(-1)[0];
    },
  },
}).$mount('#app');
