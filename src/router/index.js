import Vue from 'vue';
import Router from 'vue-router';

import Home from '@/components/home';

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
    },
    {
      path: '/competitions',
      component: Competitions,
      children: [
        {
          path: '',
          component: CompetitionsList,
        },
        {
          path: ':competitionId',
          component: Competition,
          props: true,
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
            },
            {
              path: 'schedule',
              name: 'competition.schedule',
              component: CompetitionSchedule,
            },
            {
              path: 'results',
              name: 'competition.results',
              component: CompetitionResults,
            },
            {
              path: 'admin/:tab?',
              name: 'competition.admin',
              component: CompetitionAdmin,
            },
          ],
        },
      ],
    },
  ],
});
