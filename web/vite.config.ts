import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

const report = process.env.REPORT === 'true';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    report &&
      visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
        filename: 'stats.html',
      }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      treeshake: {
        moduleSideEffects(id) {
          // firebase-js-sdk doesn't declare `sideEffects: false`, blocking elision of
          // bare imports like VueFire's `import 'firebase/app-check'`. The modular SDK
          // is designed to be effect-free at import time (services activate via getX()).
          if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return false;
          return true;
        },
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'firebase';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
