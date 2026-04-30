import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueFire, VueFireAuth, VueFireDatabaseOptionsAPI } from 'vuefire';

import App from './App.vue';
import { router } from './router';
import { firebaseApp } from './firebase';
import './style.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueFire, {
  firebaseApp,
  modules: [VueFireAuth(), VueFireDatabaseOptionsAPI()],
});

app.mount('#app');
