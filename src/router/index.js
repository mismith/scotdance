import Vue from 'vue';
import Router from 'vue-router';
import Competition from '@/components/competition';
import CompetitionInfo from '@/components/competition/info';
import CompetitionDancers from '@/components/competition/dancers';
import CompetitionResults from '@/components/competition/results';

Vue.use(Router);

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'home',
    },
    {
      path: '/competitions/:competitionId',
      // name: 'competition',
      component: Competition,
      children: [
        {
          path: '',
          name: 'competition',
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
          // component: CompetitionSchedule,
        },
        {
          path: 'results',
          name: 'competition.results',
          component: CompetitionResults,
        },
      ],
    },
  ],
});
