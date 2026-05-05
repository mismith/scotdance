import { useColorMode } from '@vueuse/core';

export type Theme = 'light' | 'dark' | 'auto';

const { store } = useColorMode<Theme>({ storageKey: 'theme' });

export function useTheme() {
  return { theme: store };
}
