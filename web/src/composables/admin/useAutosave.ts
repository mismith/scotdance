import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { canEdit, friendlyError } from '@/lib/admin/write'

// What a box that saves itself needs (TextField, VenueField): it saves
// shortly after typing stops, and whenever `commit` is called (Enter,
// leaving the box). `revert` puts back the saved value. While the database
// changes underneath (another device), the box follows it unless you're
// mid-edit.

export interface AutosaveOptions {
  /** The saved value. */
  value: () => string | number | null | undefined
  save: (value: string) => unknown
  /** For "Name can't be empty." */
  label: () => string
  required?: () => boolean | undefined
  /** What's wrong with a value, if anything. */
  validate?: (value: string) => string | null | undefined
  disabled?: () => boolean | undefined
}

const asText = (v: unknown) => (v == null ? '' : String(v))

export function useAutosave(o: AutosaveOptions) {
  const draft = ref(asText(o.value()))
  const dirty = ref(false)
  const status = ref<'idle' | 'saving' | 'saved'>('idle')
  const error = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let savedTimer: ReturnType<typeof setTimeout> | undefined
  let saving: string | null = null

  watch(o.value, (v) => {
    if (!dirty.value) draft.value = asText(v)
  })

  const locked = computed(() => !!o.disabled?.() || !canEdit.value)

  /** Something typed. */
  function input(text: string) {
    draft.value = text
    dirty.value = true
    error.value = null
    clearTimeout(timer)
    timer = setTimeout(commit, 900)
  }

  async function commit() {
    clearTimeout(timer)
    if (!dirty.value) return
    const value = draft.value.trim()
    if (o.required?.() && !value) {
      error.value = `${o.label()} can’t be empty.`
      return
    }
    const invalid = o.validate?.(value)
    if (invalid) {
      error.value = invalid
      return
    }
    // Already saving this (leaving mid-edit saves, then the box blurs as it goes).
    if (value === saving) return
    if (value === asText(o.value()).trim()) {
      dirty.value = false
      return
    }
    status.value = 'saving'
    saving = value
    try {
      await o.save(value)
      // Never touch the box here: they may still be typing (a space or a new
      // line, or more words on a slow connection), and it saves next.
      if (draft.value === value) dirty.value = false
      if (saving === value) {
        status.value = 'saved'
        clearTimeout(savedTimer)
        savedTimer = setTimeout(() => (status.value = 'idle'), 1600)
      }
    } catch (e) {
      status.value = 'idle'
      error.value = friendlyError(e)
    } finally {
      if (saving === value) saving = null
    }
  }

  function revert() {
    clearTimeout(timer)
    draft.value = asText(o.value())
    dirty.value = false
    error.value = null
  }

  // Leaving the page mid-edit still saves.
  onBeforeUnmount(() => {
    if (dirty.value) void commit()
    clearTimeout(savedTimer)
  })

  return { draft, dirty, status, error, locked, input, commit, revert }
}
