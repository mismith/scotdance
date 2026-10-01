import { useMediaQuery } from '@vueuse/core'

// Breakpoints for the Manage screens. Phones get a push/back stack; from
// `md` the list and the selected item sit side by side; from `lg` the
// section sidebar stays visible too.
export const useSplit = () => useMediaQuery('(min-width: 768px)')
export const useSidebar = () => useMediaQuery('(min-width: 1024px)')
