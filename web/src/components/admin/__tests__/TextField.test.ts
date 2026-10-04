import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const online = ref(true)
vi.mock('@/lib/admin/write', async () => {
  const { computed } = await import('vue')
  return { canEdit: computed(() => online.value), friendlyError: () => 'That change didn’t save.' }
})

const { default: TextField } = await import('@/components/admin/TextField.vue')

/** A save the test finishes when it likes, like a slow connection. */
function slowSaves() {
  const calls: Array<{ value: string; done: () => void; fail: () => void }> = []
  const save = (value: string) =>
    new Promise<void>((resolve, reject) => calls.push({ value, done: resolve, fail: () => reject(new Error('nope')) }))
  return { calls, save }
}

function field(props: Record<string, unknown>) {
  return mount(TextField, { props: { label: 'First name', modelValue: 'Ava', save: () => {}, ...props } })
}

afterEach(() => {
  online.value = true
  vi.useRealTimers()
})

describe('TextField', () => {
  it('saves on Enter, then keeps what’s typed while that save is still on its way', async () => {
    const { calls, save } = slowSaves()
    const w = field({ save })
    const input = w.find('input')
    await input.setValue('Avah')
    await input.trigger('keydown', { key: 'Enter' })
    expect(calls.map((c) => c.value)).toEqual(['Avah'])
    // Still typing while the first save is in flight.
    await input.setValue('Avah-Lee')
    calls[0].done()
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('Avah-Lee')
    await input.trigger('keydown', { key: 'Enter' })
    expect(calls.map((c) => c.value)).toEqual(['Avah', 'Avah-Lee'])
    calls[1].done()
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('Avah-Lee')
  })

  it('saves after a pause in typing, and on leaving the box', async () => {
    vi.useFakeTimers()
    const save = vi.fn()
    const w = field({ save })
    const input = w.find('input')
    await input.setValue('Avah')
    await vi.advanceTimersByTimeAsync(500)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledWith('Avah')
    await w.setProps({ modelValue: 'Avah' })
    await input.setValue('Avah Lee')
    await input.trigger('blur')
    expect(save).toHaveBeenLastCalledWith('Avah Lee')
  })

  it('keeps a space or new line typed just before a save lands', async () => {
    vi.useFakeTimers()
    const save = vi.fn()
    const w = field({ save, multiline: true, modelValue: '' })
    const box = w.find('textarea')
    await box.setValue('First paragraph.\n')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledWith('First paragraph.')
    await w.setProps({ modelValue: 'First paragraph.' })
    expect((box.element as HTMLTextAreaElement).value).toBe('First paragraph.\n')
    await box.setValue('First paragraph.\nSecond.')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenLastCalledWith('First paragraph.\nSecond.')
  })

  it('doesn’t save the same thing twice (Enter, then leaving)', async () => {
    const { calls, save } = slowSaves()
    const w = field({ save })
    const input = w.find('input')
    await input.setValue(' Avah ')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('blur')
    expect(calls.map((c) => c.value)).toEqual(['Avah'])
  })

  it('Escape puts back the saved value without saving', async () => {
    const save = vi.fn()
    const w = field({ save })
    const input = w.find('input')
    await input.setValue('Nope')
    await input.trigger('keydown', { key: 'Escape' })
    expect((input.element as HTMLInputElement).value).toBe('Ava')
    await input.trigger('blur')
    expect(save).not.toHaveBeenCalled()
  })

  it('says what’s wrong and doesn’t save: required, invalid, a link that isn’t one', async () => {
    const save = vi.fn()
    const w = field({ save, required: true, validate: (v: string) => (v === 'x' ? 'Not x.' : null) })
    const input = w.find('input')
    await input.setValue('  ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.text()).toContain('First name can’t be empty.')
    await input.setValue('x')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.text()).toContain('Not x.')
    const link = mount(TextField, { props: { label: 'Website', modelValue: '', type: 'url', save } })
    await link.find('input').setValue('see our site')
    await link.find('input').trigger('keydown', { key: 'Enter' })
    expect(link.text()).toContain('That doesn’t look like a link.')
    expect(save).not.toHaveBeenCalled()
  })

  it('follows changes made elsewhere unless you’re mid-edit', async () => {
    const w = field({})
    const input = w.find('input')
    await w.setProps({ modelValue: 'Eva' })
    expect((input.element as HTMLInputElement).value).toBe('Eva')
    await input.setValue('Evie')
    await w.setProps({ modelValue: 'Eve' })
    expect((input.element as HTMLInputElement).value).toBe('Evie')
  })

  it('keeps the text and says so when a save fails', async () => {
    const { calls, save } = slowSaves()
    const w = field({ save })
    const input = w.find('input')
    await input.setValue('Avah')
    await input.trigger('keydown', { key: 'Enter' })
    calls[0].fail()
    await flushPromises()
    expect(w.text()).toContain('That change didn’t save.')
    expect((input.element as HTMLInputElement).value).toBe('Avah')
    await input.trigger('keydown', { key: 'Enter' })
    expect(calls).toHaveLength(2)
  })

  it('reads out the hint, then the error in its place, and says when it’s required', async () => {
    const w = field({ required: true, hint: 'As on their entry form.' })
    const input = w.find('input')
    const note = () => w.find(`[id="${input.attributes('aria-describedby')}"]`).element
    expect(input.attributes('aria-required')).toBe('true')
    expect(note().textContent).toBe('As on their entry form.')
    await input.setValue('')
    await input.trigger('keydown', { key: 'Enter' })
    expect(note().textContent).toBe('First name can’t be empty.')
    // "(required)" is for the eye; the field itself says so.
    expect(w.find('label [aria-hidden="true"]').text()).toBe('(required)')
  })

  it('points at nothing when there’s nothing to read, and isn’t required unless asked', () => {
    const input = field({}).find('input')
    expect(input.attributes('aria-describedby')).toBeUndefined()
    expect(input.attributes('aria-required')).toBeUndefined()
  })

  it('locks while offline', async () => {
    online.value = false
    const w = field({})
    expect(w.find('input').attributes('disabled')).toBeDefined()
  })
})
