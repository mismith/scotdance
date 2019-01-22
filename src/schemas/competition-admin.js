import { submissionsFields } from '@/schemas/submissions';

export default {
  info: {
    order: 1,
    name: 'Info',
    icon: 'icon-info',
    subsections: {
      general: {
        order: 1,
        title: 'General',
        fields: [
          {
            data: 'image',
            title: 'Image',
            type: 'image',
            description: '(optional) SVG, PNG, or JPG image under 244KB',
            storagePath: 'competitions/images',
          },
          ...submissionsFields,
          {
            data: 'listed',
            title: 'Listed',
            type: 'checkbox',
            description: 'If enabled, show basic competition info in public listing (e.g. venue, judges)',
          },
          {
            data: 'published',
            title: 'Published',
            type: 'checkbox',
            description: 'If enabled, show all competition info in public listing (e.g. dancers, schedule)',
          },
        ],
      },
      registration: {
        order: 2,
        title: 'Registration',
        fields: [
          {
            data: 'registrationURL',
            title: 'Registration Info/Form URL',
            type: 'url',
            description: 'Link to form where participants can register',
          },
          {
            data: 'registrationStart',
            title: 'Begins',
            type: 'datetime-local',
            description: 'Date and time when registrations will begin being accepted',
          },
          {
            data: 'registrationEnd',
            title: 'Ends',
            type: 'datetime-local',
            description: 'Date and time after which registrations will no longer be accepted',
          },
        ],
      },
      permissions: {
        order: 3,
        title: 'Permissions',
      },
    },
  },
  staff: {
    order: 2,
    name: 'Staff',
    icon: 'icon-emotsmile',
    hot: {
      columns: [
        {
          data: 'type',
          title: 'Role',
          type: 'dropdown',
          source: [
            'Judge',
            'Piper',
            'Volunteer',
          ],
          required: true,
        },
        {
          data: 'firstName',
          title: 'First Name',
          required: true,
        },
        {
          data: 'lastName',
          title: 'Last Name',
          required: true,
        },
        {
          data: 'location',
          title: 'Location',
          required: true,
        },
        {
          data: 'description',
          title: 'Description',
        },
        {
          data: 'image',
          title: 'Image',
        },
      ],
    },
  },
  categories: {
    order: 3,
    name: 'Categories',
    icon: 'icon-graduation',
    hot: {
      columns: [
        {
          data: 'name',
          title: 'Name',
          required: true,
        },
      ],
    },
    presets: [
      {
        name: 'Primary',
      },
      {
        name: 'Beginner',
      },
      {
        name: 'Novice',
      },
      {
        name: 'Intermediate',
      },
      {
        name: 'Premier',
      },
      {
        name: 'Restricted Premier',
      },
      {
        name: 'Premier Special',
      },
    ],
  },
  groups: {
    order: 4,
    name: 'Age Groups',
    icon: 'icon-organization',
    hot: {
      columns: [
        {
          data: 'categoryId',
          title: 'Category',
          type: 'dropdown',
          required: true,
        },
        {
          data: 'name',
          title: 'Name',
          required: true,
        },
        {
          data: 'sponsor',
          title: 'Trophy Sponsor',
        },
        {
          data: 'trophy',
          title: 'Trophy Name',
        },
      ],
    },
    presets: [
      {
        name: '7 & Under 10 Years',
      },
      {
        name: '10 & Under 12 Years',
      },
      {
        name: '12 & Under 14 Years',
      },
      {
        name: '14 & Under 16 Years',
      },
      {
        name: '16 & Under 18 Years',
      },
      {
        name: '18 & Under 21 Years',
      },
      {
        name: '21 Years & Over',
      },
    ],
  },
  dances: {
    order: 5,
    name: 'Dances',
    icon: 'icon-music-tone-alt',
    hot: {
      columns: [
        {
          data: 'name',
          title: 'Name',
          required: true,
        },
        {
          data: 'shortName',
          title: 'Short Name',
        },
        {
          data: 'steps',
          title: 'Steps',
        },
      ],
    },
    presets: [
      {
        name: 'Pas de basques',
        shortName: 'PDB',
      },
      {
        name: 'Pas de basques & High Cuts',
        shortName: 'PDB/HC',
      },
      {
        name: 'Highland Fling',
        shortName: 'Fling',
        steps: '4',
      },
      {
        name: 'Highland Fling',
        shortName: 'Fling',
        steps: '6',
      },
      {
        name: 'Sword Dance',
        shortName: 'Sword',
        steps: '2+1',
      },
      {
        name: 'Sword Dance',
        shortName: 'Sword',
        steps: '3+1',
      },
      {
        name: 'Seann Truibhas',
        shortName: 'ST',
        steps: '3+1',
      },
      {
        name: 'Seann Truibhas',
        shortName: 'ST',
        steps: '4+2',
      },
      {
        name: 'Strathspey & Highland Reel',
        shortName: 'Reel',
        steps: '2+2',
      },
      {
        name: 'Strathspey & Highland Reel & Half Tulloch',
        shortName: 'Reel & ½ Tulloch',
        steps: '2+4',
      },
      {
        name: 'Strathspey & Half Tulloch',
        shortName: '½ Tulloch',
      },
      {
        name: 'Barracks Johnnie',
        shortName: 'Johnnie',
        steps: '4',
      },
      {
        name: 'Highland Laddie',
        shortName: 'Laddie',
        steps: '4',
      },
      {
        name: 'Scottish Lilt',
        shortName: 'Lilt',
        steps: '4',
      },
      {
        name: 'Flora MacDonald\'s Fancy',
        shortName: 'Flora',
        steps: '4',
      },
      {
        name: 'Village Maid',
        steps: '4',
      },
      {
        name: 'Blue Bonnets',
        steps: '4',
      },
      {
        name: 'Earl of Errol',
        shortName: 'Earl',
        steps: '4',
      },
      {
        name: 'Scotch Measure',
        steps: '4',
      },
      {
        name: 'Irish Jig',
        shortName: 'Jig',
        steps: '3+1',
      },
      {
        name: 'Irish Jig',
        shortName: 'Jig',
        steps: '4+1',
      },
      {
        name: 'Sailors Hornpipe',
        shortName: 'Hornpipe',
        steps: '4',
      },
      {
        name: 'Broadsword',
      },
      {
        name: 'Choreography',
      },
    ],
  },
  'dance-groups': {
    order: 6,
    name: 'Dance Groups',
    icon: 'icon-playlist',
    className: 'published-only',
  },
  dancers: {
    order: 7,
    name: 'Dancers',
    icon: 'icon-people',
    className: 'published-only',
    hot: {
      columns: [
        {
          data: 'number',
          title: '#',
          required: true,
        },
        {
          data: 'firstName',
          title: 'First Name',
          required: true,
        },
        {
          data: 'lastName',
          title: 'Last Name',
          required: true,
        },
        {
          data: 'location',
          title: 'Location',
          required: true,
        },
        {
          data: 'groupId',
          title: 'Age Group',
          type: 'dropdown',
          required: true,
        },
      ],
    },
  },
  platforms: {
    order: 8,
    name: 'Platforms',
    icon: 'icon-layers',
    className: 'published-only',
    hot: {
      columns: [
        {
          data: 'name',
          title: 'Name',
          required: true,
        },
        {
          data: 'description',
          title: 'Description',
        },
      ],
    },
  },
  schedule: {
    order: 9,
    name: 'Schedule',
    icon: 'icon-clock',
    className: 'published-only',
  },
  results: {
    order: 10,
    name: 'Results',
    icon: 'icon-trophy',
    className: 'published-only',
  },
};
