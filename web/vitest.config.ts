import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // If a test forgets to mock '@/firebase', it reaches the local
      // emulators (see useEmulators) under the development namespace.
      env: { VITE_FIREBASE_DATA_NAMESPACE: 'development' },
      include: ['src/**/__tests__/*.test.ts'],
      environment: 'happy-dom',
      environmentOptions: { happyDOM: { url: 'http://localhost/' } },
    },
  }),
)
