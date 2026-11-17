import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DancerPhoto from '../DancerPhoto.vue'
import Dialog from '@/components/Dialog.vue'
import { decodePhoto } from '../photo'

vi.mock('../photo', async (original) => ({
  ...(await original<typeof import('../photo')>()),
  decodePhoto: vi.fn(async () => ({
    url: 'blob:test-portrait',
    image: { naturalWidth: 800, naturalHeight: 1000 },
  })),
}))

describe('photo picker interactions', () => {
  it('shows preparation immediately and discards a decode cancelled while loading', async () => {
    let finish!: (value: Awaited<ReturnType<typeof decodePhoto>>) => void
    vi.mocked(decodePhoto).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = mount(DancerPhoto, {
      global: { stubs: { Dialog: { template: '<div><slot /></div>' } } },
    })
    const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' })
    await wrapper.get('.field').trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.get('[role="status"]').text()).toBe('Preparing photo…')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    wrapper.findComponent(Dialog).vm.$emit('close')
    await flushPromises()
    finish({
      url: 'blob:cancelled',
      image: { naturalWidth: 800, naturalHeight: 1000 } as HTMLImageElement,
    })
    await flushPromises()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('does not close the containing dialog when the file chooser is cancelled', async () => {
    const wrapper = mount(Dialog, {
      props: { open: false, morph: false },
      slots: { default: '<input type="file" />' },
    })
    await wrapper.get('input').trigger('cancel', { bubbles: true })
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('accepts a dropped photo into the crop dialog without saving it yet', async () => {
    const wrapper = mount(DancerPhoto, { global: { stubs: { Dialog: true } } })
    const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' })
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' }
    const field = wrapper.get('.field')
    await field.trigger('dragover', { dataTransfer })
    expect(dataTransfer.dropEffect).toBe('copy')
    expect(field.classes()).toContain('ring-2')
    await field.trigger('drop', { dataTransfer })
    await flushPromises()
    await vi.waitFor(() => expect(decodePhoto).toHaveBeenCalledWith(file))
    expect(wrapper.find('dialog-stub[aria-label="Crop photo"]').exists()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(field.classes()).not.toContain('ring-2')
    wrapper.unmount()
  })
})
