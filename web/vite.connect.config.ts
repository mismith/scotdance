import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { connectFixtures } from './scripts/connect-fixtures'
import tailwindcss from '@tailwindcss/vite'

// A separate site built from the same components and theme as ScotDance.
// No production API proxy: local previews must use fictional fixtures.
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'fixture') throw new Error('Connect fixtures are local development only')
  return {
  root: fileURLToPath(new URL('./portal', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('./portal/public', import.meta.url)),
  plugins: [
    ...(mode === 'fixture' ? [connectFixtures()] : []),
    vue(),
    tailwindcss(),
    {
      name: 'watch-shared-ui',
      configureServer(server) {
        server.watcher.add(fileURLToPath(new URL('./src', import.meta.url)))
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist-connect',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./portal/index.html', import.meta.url)),
        verification: fileURLToPath(new URL('./portal/verify-email.html', import.meta.url)),
        editor: fileURLToPath(new URL('./portal/dancer-editor.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5290,
    strictPort: true,
    watch: { usePolling: process.env.CONNECT_POLLING === 'true' },
  },
}
})
