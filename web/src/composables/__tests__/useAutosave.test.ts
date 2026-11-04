import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

// A box that saves itself, against a stand-in database value.

vi.mock('@/lib/admin/write', () => ({ canEdit: { value: true }, friendlyError: String }))

const { useAutosave } = await import('@/composables/admin/useAutosave')

/** A box whose save writes `saved(typed)` to the database, as the write does, before it resolves. */
function box(saved: (typed: string) => string) {
  const value = ref<string>('(4)')
  const a = useAutosave({
    value: () => value.value,
    save: async (v) => {
      value.value = saved(v)
      await nextTick()
    },
    label: () => 'Steps',
  })
  return { value, ...a }
}

describe('useAutosave', () => {
  it('shows what was saved when it was tidied', async () => {
    const b = box((v) => v.replace(/\s*&\s*/, '+'))
    b.input('3 & 1')
    await b.commit()
    expect(b.value.value).toBe('3+1')
    expect(b.draft.value).toBe('3+1')
    expect(b.dirty.value).toBe(false)
  })

  it('leaves the box alone when more was typed while it saved', async () => {
    const b = box((v) => v.replace(/\s*&\s*/, '+'))
    b.input('3 & 1')
    const saving = b.commit()
    b.input('3 & 1 ')
    await saving
    expect(b.draft.value).toBe('3 & 1 ')
    expect(b.dirty.value).toBe(true)
  })

  it('keeps what was typed when it was saved as is', async () => {
    const b = box((v) => v)
    b.input('6')
    await b.commit()
    expect(b.draft.value).toBe('6')
    expect(b.dirty.value).toBe(false)
  })
})
