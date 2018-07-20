import Vue from 'vue';
import Router from 'vue-router';
import {
  db,
} from '@/helpers/firebase';

import Home from '@/components/home';
import Profile from '@/components/profile';

import Competitions from '@/components/competitions';
import CompetitionsList from '@/components/competitions/list';

import Competition from '@/components/competition';
import CompetitionInfo from '@/components/competition/info';
import CompetitionDancers from '@/components/competition/dancers';
import CompetitionSchedule from '@/components/competition/schedule';
import CompetitionResults from '@/components/competition/results';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/profile',
      name: 'profile',
      component: Profile,
      meta: {
        title: 'My Profile',
      },
    },
    {
      path: '/competitions',
      component: Competitions,
      children: [
        {
          path: '',
          name: 'competitions',
          component: CompetitionsList,
          meta: {
            title: 'All Competitions',
          },
        },
        {
          path: ':competitionId',
          component: Competition,
          props: true,
          meta: {
            async title(route) {
              const snap = await db.child(`competitions/${route.params.competitionId}/name`).once('value');
              return snap.val() || 'Competition';
            },
            bodyClass: 'has-bottom-bar',
          },
          children: [
            {
              path: '',
              redirect: {
                name: 'competition.info',
              },
            },
            {
              path: 'info',
              name: 'competition.info',
              component: CompetitionInfo,
            },
            {
              path: 'dancers/:dancerId?',
              name: 'competition.dancers',
              component: CompetitionDancers,
              props: true,
              meta: {
                title: 'Dancers',
              },
            },
            {
              path: 'schedule/:dayId?/:blockId?/:eventId?/:danceId?',
              name: 'competition.schedule',
              component: CompetitionSchedule,
              props: true,
              meta: {
                title: 'Schedule',
              },
            },
            {
              path: 'results/:groupId?/:danceId?',
              name: 'competition.results',
              component: CompetitionResults,
              props: true,
              meta: {
                title: 'Results',
              },
            },
            {
              path: 'admin',
              component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin'),
              meta: {
                title: 'Competition Admin',
              },
              children: [
                {
                  path: '',
                  redirect: {
                    name: 'competition.admin.info',
                  },
                },
                {
                  path: 'info',
                  name: 'competition.admin.info',
                },
                {
                  path: 'schedule/:dayId?/:blockId?/:eventId?/:danceId?',
                  name: 'competition.admin.schedule',
                  component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin/schedule'),
                  props: true,
                },
                {
                  path: 'results/:groupId?/:danceId?',
                  name: 'competition.admin.results',
                  component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin/results'),
                  props: true,
                },
                {
                  path: 'dance-groups/:groupId?',
                  name: 'competition.admin.dance-groups',
                  component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin/dance-groups'),
                  props: true,
                },
                {
                  path: ':tab',
                  name: 'competition.admin.tab',
                  props: true,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
