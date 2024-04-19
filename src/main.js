import Vue from 'vue';
import VueFire from 'vuefire';
import VueAsyncComputed from 'vue-async-computed';
import VueBodyClass from 'vue-body-class';
import VueScrollTo from 'vue-scrollto';
import { scroller } from 'vue-scrollto/src/scrollTo';
import VueObserveVisibility from 'vue-observe-visibility';
import VueReactiveProvide from 'vue-reactive-provide';
import sanitizeHtml from 'sanitize-html';
import moment from 'moment';
import 'simple-line-icons/css/simple-line-icons.css';
import { Capacitor, Plugins } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { SplashScreen } from '@capacitor/splash-screen';

import { isDev } from '@/helpers/env';
import { analytics, firebase } from '@/helpers/firebase';
import { getTitleChunks, setTitle } from '@/helpers/router';

import App from '@/App.vue';
import router from '@/router';
import store from '@/store';
import vuetify from '@/plugins/vuetify';
import VueReactiveInject from '@/plugins/reactiveInject';

import DialogCard from '@/components/DialogCard.vue';
import Spinner from '@/components/Spinner.vue';
import EmptyState from '@/components/EmptyState.vue';
import Blades from '@/components/Blades.vue';
import Blade from '@/components/Blade.vue';
import Gravatar from '@/components/Gravatar.vue';

// disable (amongst other things) vue-localstoreage verbose logging
Vue.config.silent = true;

// app / devices
Vue.prototype.isNative = Capacitor.isNativePlatform();
Vue.prototype.isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
if (Capacitor.getPlatform() === 'ios') Plugins.ScotDance.setup();
Device.getInfo().then((device) => store.commit('setDevice', device));
window.addEventListener('load', () => SplashScreen.hide());

// libs
Vue.prototype.$sanitize = sanitizeHtml;
Vue.prototype.$moment = moment;
Vue.component('DialogCard', DialogCard);
Vue.component('EmptyState', EmptyState);
Vue.component('Gravatar', Gravatar);
Vue.component('Spinner', Spinner);
Vue.component('Blades', Blades);
Vue.component('Blade', Blade);
Vue.use(VueFire);
Vue.use(VueAsyncComputed);
Vue.use(VueBodyClass, router);
Vue.use(VueScrollTo);
Vue.use(VueObserveVisibility);
Vue.use(VueReactiveProvide);
Vue.use(VueReactiveInject);

// feature flags
store.dispatch('bindFeatureFlags');

// scrolling
const $scrollAll = (element, options = {}) => {
  const containers = options.container ? [options.container] : document.querySelectorAll(`.app-scroll${!options.force ? ':not(.persist-scroll)' : ''}`);
  Array.from(containers).forEach((container) => {
    const scrollTo = scroller();
    scrollTo(element, {
      container,
      ...options,
      onStart: (...args) => options.onStart?.(container, ...args),
      onCancel: (...args) => options.onCancel?.(container, ...args),
      onDone: (...args) => options.onDone?.(container, ...args),
    });
  });
};
Vue.prototype.$scrollAll = $scrollAll;
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
    force: true,
  });
});
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

// monitor user auth
firebase.auth().onAuthStateChanged((me) => {
  if (me) {
    store.dispatch('auth', me);
    if (analytics && me?.uid) {
      analytics.setUserId(me.uid);
    }
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

  return next();
});
router.afterEach(async (to, from) => {
  try {
    // set page title
    const titleChunks = await getTitleChunks(to);
    setTitle(titleChunks);
  } catch (error) {
    // this is nice-to-have functionality, so don't abort the flow below if something fails
    // eslint-disable-next-line no-console
    console.error(error);
  }

  // store route/tab states for restoring (e.g. on app re-open)
  const routeInfo = Vue.localStorage.get('routeInfo', {});
  routeInfo.$current = to.name;
  routeInfo[to.name] = {
    params: { // clone so mutations don't have side-effects
      ...to.params,
    },
  };
  Vue.localStorage.set('routeInfo', routeInfo);

  if (analytics && to?.fullPath !== from?.fullPath) {
    // see index.html for where the default page_view is disabled
    analytics.logEvent('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: to.fullPath,
    });
  }
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

  store.commit('setHelpAvailable', true);
}

// test helpers
if (isDev()) {
  Vue.directive('test', (el, { value }) => {
    el.setAttribute('data-test-id', value);
  });
} else {
  Vue.directive('test', {});
}

new Vue({
  computed: {
    currentTab() {
      return this.$route.params.tab || this.$route.name.split('.').slice(-1)[0];
    },
  },
  localStorage: {
    darkMode: {
      type: Boolean,
      default: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    },
  },
  watch: {
    darkMode: {
      handler(darkMode) {
        this.$vuetify.theme.dark = darkMode;
      },
      immediate: true,
    },
  },

  router,
  store,
  vuetify,
  render: (h) => h(App),
}).$mount('#app');
