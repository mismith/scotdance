import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// The day and country pickers on Add a competition, by keyboard: one stop for
// Tab, and the arrows move the choice.

vi.mock('@/lib/now', async (original) => ({ ...(await original<typeof import('@/lib/now')>()), now: () => new Date(2027, 5, 30, 10) }))
vi.mock('@/lib/haptics', () => ({ selectionHaptic: () => {} }))

const { default: DayPicker } = await import('@/components/submit/DayPicker.vue')
const { default: CountryPicker } = await import('@/components/submit/CountryPicker.vue')

describe('DayPicker', () => {
  it('starts on today’s month, with today the one stop for Tab', () => {
    const w = mount(DayPicker, { props: { modelValue: '' } })
    expect(w.text()).toContain('June 2027')
    const stops = w.findAll('button[tabindex="0"]')
    expect(stops).toHaveLength(1)
    expect(stops[0].attributes('aria-label')).toContain('June 30, 2027')
  })

  it('arrows move the day, and a week, into the next month as they go', async () => {
    const w = mount(DayPicker, { props: { modelValue: '2027-06-29', 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
    const grid = w.find('.touch-pan-y')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    expect(w.props('modelValue')).toBe('2027-06-30')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(w.props('modelValue')).toBe('2027-07-01')
    expect(w.text()).toContain('July 2027')
    await grid.trigger('keydown', { key: 'ArrowDown' })
    expect(w.props('modelValue')).toBe('2027-07-08')
    await grid.trigger('keydown', { key: 'ArrowUp' })
    expect(w.props('modelValue')).toBe('2027-07-01')
  })
})

describe('CountryPicker', () => {
  it('one stop for Tab, the chosen one; the arrows choose the next, round to the first', async () => {
    const w = mount(CountryPicker, { props: { modelValue: 'US', 'onUpdate:modelValue': (v: string | null) => w.setProps({ modelValue: v }) } })
    const radios = () => w.findAll('[role=radio]')
    expect(radios().filter((r) => r.attributes('tabindex') === '0').map((r) => r.text())).toEqual([expect.stringContaining('United States')])
    await w.find('[role=radiogroup]').trigger('keydown', { key: 'ArrowDown' })
    expect(w.props('modelValue')).toBe('AU')
    await w.find('[role=radiogroup]').trigger('keydown', { key: 'ArrowUp' })
    expect(w.props('modelValue')).toBe('US')
  })

  it('a country from elsewhere joins the list, chosen', () => {
    const w = mount(CountryPicker, { props: { modelValue: 'IE' } })
    expect(w.find('[role=radio][aria-checked=true]').text()).toContain('Ireland')
  })
})
