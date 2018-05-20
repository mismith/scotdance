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
import CompetitionAdminSchedule from '@/components/competition/admin/schedule';
import CompetitionAdminResults from '@/components/competition/admin/results';
import CompetitionAdminTab from '@/components/competition/admin/tab';

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
              name: 'competition.admin',
              component: CompetitionAdmin,
              meta: {
                title: 'Admin',
              },
              children: [
                {
                  path: 'schedule/:dayId?/:blockId?/:eventId?/:danceId?',
                  name: 'competition.admin.schedule',
                  component: CompetitionAdminSchedule,
                  props: true,
                },
                {
                  path: 'results',
                  name: 'competition.admin.results',
                  component: CompetitionAdminResults,
                  props: true,
                },
                {
                  path: ':tab',
                  name: 'competition.admin.tab',
                  component: CompetitionAdminTab,
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
