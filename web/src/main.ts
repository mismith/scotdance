import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueFire, VueFireAuth, VueFireDatabaseOptionsAPI } from 'vuefire';

import App from './App.vue';
import { router } from './router';
import { firebaseApp } from './firebase';
import './composables/useTheme';
import './style.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueFire, {
  firebaseApp,
  modules: [VueFireAuth(), VueFireDatabaseOptionsAPI()],
});

app.config.errorHandler = (err, _instance, info) => {
  console.error('[vue:error]', info, err);
};

router.onError((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)
  ) {
    window.location.reload();
    return;
  }
  console.error('[router:error]', err);
});

app.mount('#app');
