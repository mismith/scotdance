import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import InlineEdit from '../InlineEdit.vue'

describe('InlineEdit', () => {
  const note = (modelValue: string) =>
    mount(InlineEdit, { props: { modelValue, multiline: true, required: false, label: 'Note' } })

  it('shows a note stored as HTML as plain text, and leaves it be when unchanged', async () => {
    const w = note('<p>9:00 am</p><p>Main hall</p>')
    expect(w.text()).toBe('9:00 am\n\nMain hall')
    await w.find('[role="button"]').trigger('click')
    const box = w.find('textarea')
    expect((box.element as HTMLTextAreaElement).value).toBe('9:00 am\n\nMain hall')
    await box.trigger('blur')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('saves what’s typed as plain text', async () => {
    const w = note('<p>9:00 am</p>')
    await w.find('[role="button"]').trigger('click')
    await w.find('textarea').setValue('9:30 am\nMain hall')
    await w.find('textarea').trigger('blur')
    expect(w.emitted('update:modelValue')).toEqual([['9:30 am\nMain hall']])
  })
})
