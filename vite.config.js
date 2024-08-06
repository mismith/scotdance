import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';
import { createSvgPlugin } from 'vite-plugin-vue2-svg';
import ViteComponents from 'unplugin-vue-components/vite';
import eslint from 'vite-plugin-eslint';
import mkcert from 'vite-plugin-mkcert';

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
    vue(),
    createSvgPlugin(),
    ViteComponents({
      resolvers: [
        {
          type: 'component',
          resolve: (name) => {
            if (!customVuetifyLikeComponents.includes(name) && name.match(/^V[A-Z]/)) {
              return { name, from: 'vuetify/lib' };
            }
            return undefined;
          },
        },
      ],
      version: 2.7,
    }),
    eslint({
      cache: false, // it was getting stale and causing false positives
    }),
    mkcert(),
  ],
  server: {
    port: 3000,
    host: true,
  },
});
