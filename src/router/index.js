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

import CompetitionAdmin from '@/components/competition/admin';

Vue.use(Router);

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: {
        title: 'ScotDance',
      },
    },
    {
      path: '/profile',
      name: 'profile',
      component: Profile,
      meta: {
        title: 'Profile',
      },
    },
    {
      path: '/competitions',
      component: Competitions,
      meta: {
        title: 'ScotDance',
      },
      children: [
        {
          path: '',
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
          },
          children: [
            {
              path: '',
              name: 'competition.info',
              component: CompetitionInfo,
            },
            {
              path: 'dancers',
              name: 'competition.dancers',
              component: CompetitionDancers,
              meta: {
                title: 'Dancers',
              },
            },
            {
              path: 'schedule',
              name: 'competition.schedule',
              component: CompetitionSchedule,
              meta: {
                title: 'Schedule',
              },
            },
            {
              path: 'results',
              name: 'competition.results',
              component: CompetitionResults,
              meta: {
                title: 'Results',
              },
            },
            {
              path: 'admin/:tab?',
              name: 'competition.admin',
              component: CompetitionAdmin,
              meta: {
                title: 'Admin',
              },
            },
          ],
        },
      ],
    },
  ],
});
