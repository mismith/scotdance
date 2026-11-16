import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// A separate site built from the same components and theme as ScotDance.
// No production API proxy: local previews must use fictional fixtures.
export default defineConfig({
  root: fileURLToPath(new URL('./portal', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  plugins: [vue(), tailwindcss(), {
    name: 'watch-shared-ui',
    configureServer(server) { server.watcher.add(fileURLToPath(new URL('./src', import.meta.url))) },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: '../dist-connect', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5290, strictPort: true },
})
