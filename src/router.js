import Vue from 'vue';
import Router from 'vue-router';
import { db } from '@/helpers/firebase';
import adminSchema from '@/schemas/admin';
import competitionSchema from '@/schemas/competition';
import competitionAdminSchema from '@/schemas/competition-admin';

import Home from '@/views/Home.vue';
import Settings from '@/views/Settings.vue';
import Profile from '@/views/Profile.vue';
import Policies from '@/views/Policies.vue';

import Dancers from '@/views/Dancers.vue';

import Competitions from '@/views/Competitions.vue';
import CompetitionsList from '@/views/competitions/List.vue';
import CompetitionsSubmit from '@/views/competitions/Submit.vue';

import Competition from '@/views/Competition.vue';
import CompetitionInfo from '@/views/competition/Info.vue';
import CompetitionDancers from '@/views/competition/Dancers.vue';
import CompetitionSchedule from '@/views/competition/Schedule.vue';
import CompetitionResults from '@/views/competition/Results.vue';
import CompetitionInvite from '@/views/competition/Invite.vue';

const CompetitionAdmin = () => import('@/views/competition/Admin.vue');
const CompetitionAdminInfo = () => import('@/views/competition/admin/Info.vue');
const CompetitionAdminSchedule = () => import('@/views/competition/admin/Schedule.vue');
const CompetitionAdminResults = () => import('@/views/competition/admin/Results.vue');
const CompetitionAdminDanceGroups = () => import('@/views/competition/admin/DanceGroups.vue');

const Admin = () => import('@/views/Admin.vue');
const AdminInfo = () => import('@/views/admin/Info.vue');
const AdminSubmissions = () => import('@/views/admin/Submissions.vue');
const AdminDancers = () => import('@/views/admin/Dancers.vue');
const AdminUsers = () => import('@/views/admin/Users.vue');

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
      path: '/settings',
      name: 'settings',
      component: Settings,
      meta: {
        title: 'App Settings',
      },
    },
    {
      path: '/policies/:policyId?',
      name: 'policies',
      component: Policies,
      meta: {
        title: 'Policies',
      },
    },
    {
      path: '/dancers',
      name: 'dancers',
      component: Dancers,
      meta: {
        title: 'Dancers',
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
            title: 'Browse Competitions',
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
          meta: {
            async title(route) {
              const snap = await db
                .child(`competitions/${route.params.competitionId}/name`)
                .once('value');
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
              meta: {
                title: competitionSchema.dancers.name,
              },
            },
            {
              path: 'schedule/:dayId?/:blockId?/:eventId?/:danceId?',
              name: 'competition.schedule',
              component: CompetitionSchedule,
              meta: {
                title: competitionSchema.schedule.name,
              },
            },
            {
              path: 'results/:groupId?/:danceId?',
              name: 'competition.results',
              component: CompetitionResults,
              meta: {
                title: competitionSchema.results.name,
              },
            },
            {
              path: 'invites/:inviteId',
              name: 'competition.invite',
              component: CompetitionInvite,
              meta: {
                title: 'Your Invitation',
              },
            },
            {
              path: 'admin',
              component: CompetitionAdmin,
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
                  component: CompetitionAdminInfo,
                  meta: {
                    title(route) {
                      const section = competitionAdminSchema.info;
                      const subsection = section.subsections[route.params.subsectionId];
                      return subsection && subsection.name;
                    },
                  },
                },
                {
                  path: 'schedule/:dayId?/:blockId?/:eventId?/:danceId?',
                  name: 'competition.admin.schedule',
                  component: CompetitionAdminSchedule,
                  meta: {
                    title: competitionAdminSchema.schedule.name,
                  },
                },
                {
                  path: 'results/:groupId?/:danceId?/:tabId?',
                  name: 'competition.admin.results',
                  component: CompetitionAdminResults,
                  meta: {
                    title: competitionAdminSchema.results.name,
                  },
                },
                {
                  path: 'dance-groups/:groupId?',
                  name: 'competition.admin.dance-groups',
                  component: CompetitionAdminDanceGroups,
                  meta: {
                    title: competitionAdminSchema['dance-groups'].name,
                  },
                },
                {
                  path: ':tab',
                  name: 'competition.admin.tab',
                  meta: {
                    title(route) {
                      const section = competitionAdminSchema[route.params.tab];
                      return section && section.name;
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      path: '/admin',
      component: Admin,
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
          redirect: 'info/versions',
        },
        {
          path: 'info/:subsectionId?',
          name: 'admin.info',
          component: AdminInfo,
          meta: {
            title(route) {
              const section = adminSchema.info;
              const subsection = section.subsections[route.params.subsectionId];
              return subsection && subsection.name;
            },
          },
        },
        {
          path: 'submissions/:submissionId?',
          name: 'admin.submissions',
          component: AdminSubmissions,
          meta: {
            title: 'Submissions',
          },
        },
        {
          path: 'users/:userId?',
          name: 'admin.users',
          component: AdminUsers,
          meta: {
            title: 'Users',
          },
        },
        {
          path: 'dancers',
          name: 'admin.dancers',
          component: AdminDancers,
          meta: {
            title: 'Dancers',
          },
        },
        {
          path: ':tab',
          name: 'admin.tab',
        },
      ],
    },
  ],
});
