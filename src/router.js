import Vue from 'vue';
import Router from 'vue-router';
import { db } from '@/helpers/firebase';

import Home from '@/views/Home.vue';
import Profile from '@/views/Profile.vue';

import Competitions from '@/views/Competitions.vue';
import CompetitionsList from '@/views/competitions/List.vue';
import CompetitionsSubmit from '@/views/competitions/Submit.vue';

import Competition from '@/views/Competition.vue';
import CompetitionInfo from '@/views/competition/Info.vue';
import CompetitionDancers from '@/views/competition/Dancers.vue';
import CompetitionSchedule from '@/views/competition/Schedule.vue';
import CompetitionResults from '@/views/competition/Results.vue';
import CompetitionInvite from '@/views/competition/Invite.vue';

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
          path: 'submit',
          name: 'competitions.submit',
          component: CompetitionsSubmit,
          meta: {
            title: 'Submit Competition',
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
              path: 'invites/:inviteId',
              name: 'competition.invite',
              component: CompetitionInvite,
              props: true,
              meta: {
                title: 'Your Invitation',
              },
            },
            {
              path: 'admin',
              component: () => import(/* webpackChunkName: "admin" */ '@/views/competition/Admin.vue'),
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
                  component: () => import(/* webpackChunkName: "admin" */ '@/views/competition/admin/Info.vue'),
                  props: true,
                },
                {
                  path: 'schedule/:dayId?/:blockId?/:eventId?/:danceId?',
                  name: 'competition.admin.schedule',
                  component: () => import(/* webpackChunkName: "admin" */ '@/views/competition/admin/Schedule.vue'),
                  props: true,
                },
                {
                  path: 'results/:groupId?/:danceId?',
                  name: 'competition.admin.results',
                  component: () => import(/* webpackChunkName: "admin" */ '@/views/competition/admin/Results.vue'),
                  props: true,
                },
                {
                  path: 'dance-groups/:groupId?',
                  name: 'competition.admin.dance-groups',
                  component: () => import(/* webpackChunkName: "admin" */ '@/views/competition/admin/DanceGroups.vue'),
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
      component: () => import(/* webpackChunkName: "admin" */ '@/views/Admin.vue'),
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
          component: () => import(/* webpackChunkName: "admin" */ '@/views/admin/Info.vue'),
        },
        {
          path: 'submissions/:submissionId?',
          name: 'admin.submissions',
          component: () => import(/* webpackChunkName: "admin" */ '@/views/admin/Submissions.vue'),
          props: true,
        },
        {
          path: 'users/:userId?',
          name: 'admin.users',
          component: () => import(/* webpackChunkName: "admin" */ '@/views/admin/Users.vue'),
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
