import path from 'path';
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import { createSvgPlugin } from 'vite-plugin-vue2-svg';
import ViteComponents from 'unplugin-vue-components/vite';
import { VuetifyResolver } from 'unplugin-vue-components/resolvers';
import eslintPlugin from 'vite-plugin-eslint';

const customVuetifyLikeComponents = [
  'VFile',
];

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  build: {
    outDir: 'www',
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/compat'],
          vuetify: ['vuetify', 'vuetify/lib'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '~vuetify': 'vuetify',
    },
  },
  plugins: [
    createVuePlugin(),
    createSvgPlugin(),
    ViteComponents({
      resolvers: [
        (name) => !customVuetifyLikeComponents.includes(name) && VuetifyResolver()(name),
      ],
    }),
    eslintPlugin({
      cache: false, // it was getting stale and causing false positives
    }),
  ],
});
