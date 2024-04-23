import path from 'path';
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import ViteComponents from 'unplugin-vue-components/vite';
import { VuetifyResolver } from 'unplugin-vue-components/resolvers';
import eslintPlugin from 'vite-plugin-eslint';
import visualizer from 'rollup-plugin-visualizer';

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
      plugins: [
        visualizer(),
      ],
      output: {
        manualChunks: {
          firebase: ['firebase'],
          vuetify: ['vuetify', 'vuetify/lib'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~vuetify': 'vuetify',
    },
  },
  plugins: [
    createVuePlugin(),
    ViteComponents({
      resolvers: [
        (name) => !customVuetifyLikeComponents.includes(name) && VuetifyResolver()(name),
      ],
    }),
    eslintPlugin({
      cache: false, // it was getting stale and causing false positives
      throwOnWarning: false,
    }),
  ],
});
