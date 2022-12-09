import { mdiCounter } from '@mdi/js';

export default {
  info: {
    order: 1,
    name: 'Info',
    icon: 'icon-info',
    subsections: {
      versions: {
        order: 1,
        name: 'Versions',
        icon: mdiCounter,
        fields: [
          {
            data: 'current',
            title: 'Current ',
            disabled: true,
          },
          {
            data: 'web',
            title: 'Web ',
          },
          {
            data: 'ios',
            title: 'iOS ',
          },
          {
            data: 'android',
            title: 'Android ',
          },
        ],
      },
      faqs: {
        order: 2,
        name: 'FAQs',
        icon: 'icon-question',
        hot: {
          columns: [
            {
              data: 'question',
              title: 'Question',
            },
            {
              data: 'answer',
              title: 'Answer',
            },
          ],
        },
      },
    },
  },
  submissions: {
    order: 2,
    name: 'Submissions',
    icon: 'icon-plus',
  },
  dancers: {
    order: 3,
    name: 'Dancers',
    icon: 'icon-user',
  },
  users: {
    order: 4,
    name: 'Users',
    icon: 'icon-people',
    fields: [
      {
        data: 'displayName',
        title: 'Display Name',
      },
      {
        data: 'email',
        title: 'Email',
        disabled: true,
      },
      {
        data: '.key',
        title: 'ID',
        disabled: true,
      },
    ],
  },
};
