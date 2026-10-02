import { inject, onBeforeUnmount, onMounted, provide, ref, type Ref } from 'vue'
import { useScrolledPast } from '@/composables/useScrolledPast'

// A Manage page's own title (its SectionHeader) and the bar's: the bar
// names the page only once the page's title has scrolled away under it, so
// the two never show at once. Pages without a SectionHeader keep the bar's.

const key = Symbol('sectionTitle')

/** In the layout: whether the bar should show the page's name. */
export function provideSectionTitle() {
  const el = ref<HTMLElement | null>(null)
  provide(key, el)
  const scrolledPast = useScrolledPast(el)
  return { showInBar: () => !el.value || scrolledPast.value }
}

/** In the page's header: its title element. */
export function useSectionTitle(title: Ref<HTMLElement | null>) {
  const el = inject<Ref<HTMLElement | null> | null>(key, null)
  if (!el) return
  onMounted(() => (el.value = title.value))
  onBeforeUnmount(() => {
    if (el.value === title.value) el.value = null
  })
}
