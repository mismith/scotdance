export const submissionsFields = [
  {
    data: 'name',
    required: true,
    title: 'Name',
    description: 'e.g. "Canadian Championships 2018"',
  },
  {
    data: 'date',
    required: true,
    title: 'Date',
    type: 'date',
    description: 'e.g. "2018-07-30"',
  },
  {
    data: 'venue',
    title: 'Venue Name',
    description: 'e.g. "Telus Convention Centre"',
  },
  {
    data: 'address',
    title: 'Venue Address',
    description: 'e.g. "120 9th Ave SE"',
  },
  {
    data: 'location',
    required: true,
    title: 'Location',
    description: 'e.g. "Calgary, AB" or "Calgary, Alberta, Canada"',
  },
  {
    data: 'description',
    title: 'Description',
    type: 'textarea',
    description: '(optional) Any other important info you wish to highlight',
  },
  {
    data: 'sobhd',
    title: 'SOBHD Registration Number',
    description: 'e.g. "C-AB-CO-12-3456"',
  },
];

export const checklists = {
  today: {
    order: 1,
    title: 'What you need to do <strong>today</strong>:',
    items: [
      {
        title: 'submit this form',
        icon: 'mdi-send',
        description: 'It only takes a few minutes—and if you have a competition info sheet already, you\'re already mostly done. You can always make edits later, of course.',
      },
      {
        title: 'await approval',
        icon: 'mdi-thumb-up',
        description: 'It may take up to 7 days for your submission to be reviewed, but usually it\'ll be done overnight.',
      },
    ],
  },
  before: {
    order: 2,
    title: 'What you need to do <strong>before</strong> the competition:',
    items: [
      {
        title: 'build out competition details',
        icon: 'mdi-assignment',
        description: 'Essentially, all the information you put into a paper program goes into the app via an easy-to-use admin panel (that you\'ll gain access to once your submission is approved).',
      },
      {
        title: 'import dancer registrations',
        icon: 'mdi-backup',
        description: 'You can either upload a properly formatted Excel spreadsheet, or fill in the dancers, categories, and age groups using the admin panel\'s Excel-like interface.',
      },
    ],
  },
  during: {
    order: 3,
    title: 'What you need to do <strong>during</strong> the competition:',
    items: [
      {
        title: 'have access to a laptop or tablet',
        icon: 'mdi-devices',
        description: 'While you can technically use a phone to input results, it\'s much easier on a larger screen.',
      },
      {
        title: 'have an active internet connection',
        icon: 'mdi-wifi',
        description: 'Keep in mind that you\'ll need either WiFi or cell signal at the location where you\'ll be inputting results (e.g. announcer\'s desk).',
      },
      {
        title: 'have a volunteer enter results in real-time',
        icon: 'mdi-touch-app',
        description: '<p>Inputting results with the admin panel is almost the same as viewing results in the app—all that\'s required is the ability to listen (or read) and click along.</p><p>Having results sheets printouts available is crucial to not missing any announcements. It can be equally helpful to have a partner alongside you to check for mistakes.</p>',
      },
    ],
  },
};

export default {
  competition: {
    order: 1,
    name: 'Competition Info',
    fields: submissionsFields,
  },
  contact: {
    order: 2,
    name: 'Contact Info',
    fields: [
      {
        data: 'name',
        title: 'Your Name',
        required: true,
      },
      {
        data: 'email',
        title: 'Your Email',
        type: 'email',
        required: true,
      },
      {
        data: 'message',
        title: 'Message',
        type: 'textarea',
        description: '(optional) Any questions, notes, or feedback?',
      },
      {
        data: 'disclaimer',
        title: 'I acknowledge',
        type: 'checkbox',
        required: true,
        prepend: 'Please note that this is a volunteer-run app, and as such it can offer <strong>no warranty of any kind</strong>.',
      },
    ],
    submitLabel: 'Submit',
  },
};
