import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const report = process.env.REPORT === 'true'

// The assistants' door (ADR 0018): the `mcp` function answers these paths. In production Hosting rewrites them
// (firebase.json, the `next` target); against the emulators the dev server stands in, so
// http://localhost:5273/mcp behaves the same. (The proxy adds the original path after the function's address.)
const MCP_PATHS = ['/mcp', '/oauth', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource']

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
      // The app, and the page organisers' other tools open to send it their work (src/connect).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        connect: fileURLToPath(new URL('./connect.html', import.meta.url)),
      },
      treeshake: {
        moduleSideEffects(id) {
          // firebase-js-sdk doesn't declare `sideEffects: false`, blocking elision of
          // bare imports like VueFire's `import 'firebase/app-check'`. The modular SDK
          // is designed to be effect-free at import time (services activate via getX()).
          if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return false
          return true
        },
      },
      output: {
        manualChunks(id) {
          // Storage is only for Manage uploads: leave it to load with Manage.
          if (/node_modules\/(@firebase|firebase)\/storage/.test(id)) return undefined
          if (
            id.includes('node_modules/firebase/') ||
            id.includes('node_modules/@firebase/')
          ) {
            return 'firebase'
          }
        },
      },
    },
  },
  // Imported only when they're needed (a Word download, a spreadsheet or a
  // PDF of judges' sheets), so the dev server's first look misses them. Found
  // later, re-optimising can reload the page mid-use (or mid-test).
  optimizeDeps: {
    include: ['docx', 'read-excel-file/browser', 'pdfjs-dist/legacy/build/pdf.mjs'],
  },
  server: {
    host: true,
    // (Only the dev server uses this; builds ignore it. A second stack on shifted ports sets VITE_EMULATOR_PORT_OFFSET.)
    proxy: Object.fromEntries(
      MCP_PATHS.map((path) => [
        `^${path.replaceAll('.', '\\.')}(/.*)?$`,
        { target: `http://127.0.0.1:${5001 + (Number(process.env.VITE_EMULATOR_PORT_OFFSET) || 0)}/firebase-scotdance/us-central1/mcp` },
      ]),
    ),
  },
})
