import { computed, ref } from 'vue'

const openId = ref<string | null>(null)

export function useExpandedPill(id: string) {
  const isOpen = computed(() => openId.value === id)
  const anyOpen = computed(() => openId.value !== null)

  function open() {
    openId.value = id
  }
  function close() {
    if (openId.value === id) openId.value = null
  }
  function toggle() {
    openId.value = openId.value === id ? null : id
  }

  return { isOpen, anyOpen, open, close, toggle }
}

export function useAnyPillOpen() {
  return computed(() => openId.value !== null)
}

export function closeAllPills() {
  openId.value = null
}
