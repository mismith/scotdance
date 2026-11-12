import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CompetitionsCalendar from '../CompetitionsCalendar.vue'

const routing = vi.hoisted(() => ({ date: '2026-11-14', replace: vi.fn() }))
vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ query: { date: routing.date, view: 'calendar' } }),
  useRouter: () => ({ replace: routing.replace }),
}))
vi.mock('@/stores/favorites', () => ({ useFavoritesStore: () => ({ isFavorite: () => false }) }))
vi.mock('@/composables/useCompetitionLinks', () => ({
  useCompetitionLinks: () => ({ linkOf: () => null, othersLine: () => null }),
}))
vi.mock('@/lib/haptics', () => ({ selectionHaptic: vi.fn() }))
vi.mock('@/components/CompetitionDateRow.vue', () => ({
  default: { props: ['competition'], template: '<li>{{ competition.name }}</li>' },
}))

const competitions = [
  { id: 'previous', name: 'Previous competition', date: '2026-11-07' },
  { id: 'selected', name: 'Selected competition', date: '2026-11-14' },
  { id: 'next', name: 'Next competition', date: '2026-12-05' },
  { id: 'next-two', name: 'Second next competition', date: '2026-12-05' },
]
const render = () => mount(CompetitionsCalendar, { props: { competitions }, global: { directives: { proximity: {} } } })
afterEach(() => { routing.date = '2026-11-14'; vi.clearAllMocks() })

describe('nearest event date links', () => {
  it('shows counts in both directions without rendering nearby event lists', () => {
    const wrapper = render()
    expect(wrapper.findAll('li').map((row) => row.text())).toEqual(['Selected competition'])
    const buttons = wrapper.find('nav').findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.element.parentElement?.textContent).toContain('1 event')
    expect(buttons[1]!.element.parentElement?.textContent).toContain('2 events')
    expect(buttons[0]!.attributes('aria-label')).toMatch(/^Previous event date:/)
    expect(buttons[1]!.attributes('aria-label')).toMatch(/^Next event date:/)
    wrapper.unmount()
  })

  it('selects a nearby day across months, updates the URL, and can return', async () => {
    const wrapper = render()
    await wrapper.find('nav button[aria-label^="Next"]').trigger('click')
    await flushPromises()
    expect(routing.replace).toHaveBeenLastCalledWith({ query: { date: '2026-12-05', view: 'calendar' } })
    expect(wrapper.find('h2').text()).toContain('December')
    expect(wrapper.findAll('li').map((row) => row.text())).toEqual(['Next competition', 'Second next competition'])
    expect(wrapper.find('nav button[aria-label^="Next"]').exists()).toBe(false)
    expect(wrapper.findAll('button[aria-pressed="true"]')).toHaveLength(1)
    await wrapper.find('nav button[aria-label^="Previous"]').trigger('click')
    await flushPromises()
    expect(routing.replace).toHaveBeenLastCalledWith({ query: { date: '2026-11-14', view: 'calendar' } })
    expect(wrapper.findAll('li').map((row) => row.text())).toEqual(['Selected competition'])
    wrapper.unmount()
  })

  it('offers a next date on an empty day and hides navigation for the whole month', () => {
    routing.date = '2026-11-01'
    const empty = render()
    expect(empty.text()).toContain('Nothing on this day.')
    expect(empty.findAll('nav button')).toHaveLength(1)
    expect(empty.find('nav button').attributes('aria-label')).toMatch(/^Next event date:/)
    expect(empty.findAll('li')).toHaveLength(0)
    empty.unmount()
    routing.date = '2026-11'
    const month = render()
    expect(month.find('nav').exists()).toBe(false)
    month.unmount()
  })
})
