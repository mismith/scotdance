export default {
  info: {
    order: 1,
    name: 'Info',
    icon: 'icon-info',
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
  users: {
    order: 3,
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
