import Vue from 'vue';
import Router from 'vue-router';
import { db } from '@/helpers/firebase';

import Home from '@/components/Home.vue';
import Profile from '@/components/Profile.vue';

import Competitions from '@/components/Competitions.vue';
import CompetitionsList from '@/components/competitions/List.vue';

import Competition from '@/components/Competition.vue';
import CompetitionInfo from '@/components/competition/Info.vue';
import CompetitionDancers from '@/components/competition/Dancers.vue';
import CompetitionSchedule from '@/components/competition/Schedule.vue';
import CompetitionResults from '@/components/competition/Results.vue';

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
              redirect: 'info',
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
              component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/Admin.vue'),
              meta: {
                title: 'Competition Admin',
              },
              children: [
                {
                  path: '',
                  redirect: 'info',
                },
                {
                  path: 'info',
                  redirect: 'info/general',
                },
                {
                  path: 'info/:subsectionId?',
                  name: 'competition.admin.info',
                  component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin/Info.vue'),
                  props: true,
                },
                {
                  path: 'schedule/:dayId?/:blockId?/:eventId?/:danceId?',
                  name: 'competition.admin.schedule',
                  component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin/Schedule.vue'),
                  props: true,
                },
                {
                  path: 'results/:groupId?/:danceId?',
                  name: 'competition.admin.results',
                  component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin/Results.vue'),
                  props: true,
                },
                {
                  path: 'dance-groups/:groupId?',
                  name: 'competition.admin.dance-groups',
                  component: () => import(/* webpackChunkName: "admin" */ '@/components/competition/admin/DanceGroups.vue'),
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
    {
      path: '/admin',
      component: () => import(/* webpackChunkName: "admin" */ '@/components/Admin.vue'),
      meta: {
        title: 'App Admin',
      },
      children: [
        {
          path: '',
          redirect: 'info',
        },
        {
          path: 'info',
          name: 'admin.info',
          component: () => import(/* webpackChunkName: "admin" */ '@/components/admin/Info.vue'),
        },
        {
          path: 'users/:userId?',
          name: 'admin.users',
          component: () => import(/* webpackChunkName: "admin" */ '@/components/admin/Users.vue'),
          props: true,
        },
        {
          path: ':tab',
          name: 'admin.tab',
          // props: true, // @TODO: why does this cause an error?
        },
      ],
    },
  ],
});
