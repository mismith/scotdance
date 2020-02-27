import competitionSchema from '@/schemas/competition';
import { submissionsFields } from '@/schemas/submissions';

export default {
  info: {
    ...competitionSchema.info,
    subsections: {
      general: {
        order: 1,
        name: 'General',
        icon: 'icon-info',
        fields: [
          {
            data: 'image',
            title: 'Image',
            type: 'file',
            description: '(optional) Must be under 244KB in file size',
            storagePath: 'competitions/info',
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
        name: 'Registration',
        icon: 'icon-direction',
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
      links: {
        order: 3,
        name: 'Links',
        icon: 'icon-link',
        hot: {
          columns: [
            {
              data: 'name',
              title: 'Name',
              required: true,
            },
            {
              data: 'url',
              title: 'URL',
              type: 'file',
              required: true,

              storagePath: 'competitions/links',
              maxSize: 244 * 4 * 1024,
              accept: 'application/pdf, image/*',
            },
          ],
        },
      },
      permissions: {
        order: 4,
        name: 'Permissions',
        icon: 'icon-lock',
      },
    },
  },
  staff: {
    order: 2,
    name: 'Attribution',
    icon: 'icon-heart',
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
            'Sponsor',
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
          type: 'textarea',
        },
        {
          data: 'image',
          title: 'Image',
          type: 'file',
          storagePath: 'competitions/staff',
        },
        {
          data: 'website',
          title: 'Website',
          // type: 'url',
        },
      ],
    },
  },
  dances: {
    order: 3,
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
  categories: {
    order: 4,
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
    order: 5,
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
          title: 'Age Range',
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
  dancers: {
    ...competitionSchema.dancers,
    order: 6,
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
  'dance-groups': {
    order: 7,
    name: 'Dance Groups',
    icon: 'icon-playlist',
    className: 'published-only',
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
          type: 'textarea',
        },
      ],
    },
    presets: [
      {
        name: 'A',
      },
      {
        name: 'B',
      },
      {
        name: 'C',
      },
      {
        name: 'Stage',
      },
    ],
  },
  schedule: {
    ...competitionSchema.schedule,
    order: 9,
  },
  results: {
    ...competitionSchema.results,
    order: 10,
  },
};
