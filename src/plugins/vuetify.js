import Vue from 'vue';
import Vuetify from 'vuetify/lib';
import colors from 'vuetify/lib/util/colors';
import 'roboto-fontface/css/roboto/roboto-fontface.css';

Vue.use(Vuetify);

const palette = {
  primary: '#1976d2',
  secondary: colors.pink,
};

export default new Vuetify({
  icons: {
    iconfont: 'mdiSvg',
  },
  theme: {
    themes: {
      light: palette,
      dark: palette,
    },
  },
});
