import { mdiCounter, mdiDatabaseRefresh, mdiMapMarkerRadius } from '@mdi/js';

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
      indexes: {
        order: 2,
        name: 'Indexes',
        icon: mdiDatabaseRefresh,
      },
      geolocation: {
        order: 3,
        name: 'Geolocation',
        icon: mdiMapMarkerRadius,
      },
    },
  },
  submissions: {
    order: 2,
    name: 'Submissions',
    icon: 'icon-plus',
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
