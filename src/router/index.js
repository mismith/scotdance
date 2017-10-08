import Vue from 'vue';
import Router from 'vue-router';
import HelloWorld from '@/components/hello-world';

Vue.use(Router);

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'Hello',
      component: HelloWorld,
    },
  ],
});
