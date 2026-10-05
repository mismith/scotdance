import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'

// Submitting a competition: signed in only, an overview and then a step at a
// time, sending the same shape as ever (the approval function reads it),
// with a draft that outlasts a reload.

const write = vi.fn(async (updates: Record<string, unknown>) => void updates)
vi.mock('@/lib/admin/write', () => ({
  write: (updates: Record<string, unknown>) => write(updates),
  newKey: () => 'sub1',
  friendlyError: (e: unknown) => String(e),
}))
vi.mock('@/lib/maps', () => ({ placesAvailable: true }))

const auth = reactive({ authReady: true, isSignedIn: true, uid: 'u1' as string | null, openLogin: vi.fn() })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/me', () => ({ useMeStore: () => ({ email: 'morag@example.test', displayName: null, managedOrganisationIds: [] }) }))
vi.mock('@/composables/useOrganisations', () => ({ useOrganisations: () => ({ organisations: ref([]), byId: ref(new Map()), loaded: ref(true), error: ref(null), retry: () => {} }) }))
vi.mock('@/composables/usePageTitle', () => ({ usePageTitle: () => {} }))

// The venue box (tested on its own): types a name, or hands back a pick.
const VenueField = defineComponent({
  name: 'VenueField',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue', 'pick'],
  setup: (props, { emit }) => () =>
    h('div', [
      h('label', { for: 'venue' }, 'Venue name'),
      h('input', { id: 'venue', value: props.modelValue, onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }),
    ]),
})
vi.mock('@/components/admin/VenueField.vue', () => ({ default: VenueField }))

const { default: Submit } = await import('@/views/competitions/Submit.vue')

type Wrapper = ReturnType<typeof mount>
const render = () => mount(Submit, { global: { stubs: { AppBar: true, RouterLink: true } } })
const input = (w: Wrapper, label: string) => w.find(`#${w.findAll('label').find((l) => l.text().startsWith(label))!.attributes('for')}`)
const value = (w: Wrapper, label: string) => (input(w, label).element as HTMLInputElement).value
const button = (w: Wrapper, text: string) => w.findAll('button').find((b) => b.text().trim() === text)!
const stepper = (w: Wrapper, n: number) => w.findAll('nav[aria-label="Steps"] button')[n - 1]
async function next(w: Wrapper) {
  await w.find('form').trigger('submit')
  await flushPromises()
}
/** Past the overview, on step 1. */
async function begin() {
  const w = render()
  await button(w, 'Start').trigger('click')
  await flushPromises()
  return w
}
const sentValue = () => write.mock.calls[0][0]['competitions:submissions/sub1'] as Record<string, Record<string, unknown>>

/** Steps 1 to 3 with just what's required, ending on the review. */
async function toReview(w: Wrapper, { pick }: { pick?: Record<string, unknown> } = {}) {
  await input(w, 'Name').setValue('Calgary Highland Games')
  await input(w, 'Date').setValue('2027-06-05')
  await next(w)
  if (pick) {
    w.findComponent(VenueField).vm.$emit('pick', pick)
    await flushPromises()
  } else {
    await input(w, 'Town or city').setValue('Calgary, AB')
  }
  await next(w)
  await input(w, 'Your name').setValue('Morag Ross')
  await next(w)
}

const TELUS = {
  venue: 'Telus Convention Centre',
  address: '120 9 Ave SE',
  location: 'Calgary, AB',
  lat: 51.04,
  lng: -114.06,
  country: 'CA',
  region: 'AB',
  locality: 'Calgary',
}

beforeEach(() => {
  write.mockClear()
  auth.openLogin.mockClear()
  Object.assign(auth, { isSignedIn: true, uid: 'u1' })
  localStorage.clear()
})

describe('Submit a competition', () => {
  it('signed out: the overview and a way in, but no form or venue search', async () => {
    Object.assign(auth, { isSignedIn: false, uid: null })
    const w = render()
    await flushPromises()
    expect(w.text()).toContain('What you’ll need')
    // What's needed later is tucked away until asked for.
    expect(w.text()).not.toContain('A laptop or tablet.')
    await button(w, 'On the day').trigger('click')
    expect(w.text()).toContain('A laptop or tablet.')
    expect(button(w, 'On the day').attributes('aria-expanded')).toBe('true')
    expect(button(w, 'Before the competition').attributes('aria-expanded')).toBe('false')
    expect(w.find('form').exists()).toBe(false)
    expect(w.findComponent(VenueField).exists()).toBe(false)
    await button(w, 'Sign in to submit').trigger('click')
    expect(auth.openLogin).toHaveBeenCalledWith({ reason: 'account' })

    // Signing in from there goes straight on to the first step.
    Object.assign(auth, { isSignedIn: true, uid: 'u1' })
    await flushPromises()
    expect(w.text()).toContain('Step 1 of 4')
  })

  it('signed in: the overview first, then Start', async () => {
    const w = render()
    expect(w.text()).toContain('Before the competition')
    expect(w.find('form').exists()).toBe(false)
    await button(w, 'Start').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 1 of 4')
  })

  it('won’t move on until the step’s required fields are filled in', async () => {
    const w = await begin()
    await next(w)
    expect(w.text()).toContain('Step 1 of 4')
    expect(w.text()).toContain('Add the competition’s name.')
    expect(w.text()).toContain('Add the date.')

    await input(w, 'Name').setValue('Calgary Highland Games')
    expect(w.text()).not.toContain('Add the competition’s name.')
    await input(w, 'Date').setValue('2027-06-05')
    await next(w)
    expect(w.text()).toContain('Step 2 of 4')
    await next(w)
    expect(w.text()).toContain('Add the town or city.')
    expect(w.text()).toContain('Step 2 of 4')
  })

  it('the description and registration number go with the competition, on step 1', async () => {
    const w = await begin()
    await button(w, 'Add a description').trigger('click')
    await input(w, 'Description').setValue('Free parking.')
    await button(w, 'Add registration number').trigger('click')
    await input(w, 'Registration number').setValue('C-AB-CO-27-1234')
    await toReview(w)
    expect(w.find('dl').text()).toContain('Free parking.')
    expect(w.find('dl').text()).toContain('Registration: C-AB-CO-27-1234')
    await w.find('[role=checkbox]').trigger('click')
    await next(w)
    expect(sentValue().competition).toMatchObject({ description: 'Free parking.', sobhd: 'C-AB-CO-27-1234' })
  })

  it('says the contact details aren’t shown publicly', async () => {
    const w = await begin()
    await input(w, 'Name').setValue('Calgary Highland Games')
    await input(w, 'Date').setValue('2027-06-05')
    await next(w)
    await input(w, 'Town or city').setValue('Calgary, AB')
    await next(w)
    expect(w.text()).toContain('Only used to contact you about this submission. None of it is shown publicly.')
  })

  it('Back keeps what was typed', async () => {
    const w = await begin()
    await input(w, 'Name').setValue('Calgary Highland Games')
    await input(w, 'Date').setValue('2027-06-05')
    await next(w)
    await button(w, 'Back').trigger('click')
    await flushPromises()
    expect(value(w, 'Name')).toBe('Calgary Highland Games')
    expect(value(w, 'Date')).toBe('2027-06-05')
  })

  it('the stepper goes back freely, and forward only as far as the steps on the way are done', async () => {
    const w = await begin()
    expect(w.findAll('nav[aria-label="Steps"] button').map((b) => b.text())).toEqual(['Step 1: Details', 'Step 2: Venue', 'Step 3: Contact', 'Step 4: Review'])
    expect(stepper(w, 1).attributes('aria-current')).toBe('step')

    await stepper(w, 4).trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 1 of 4')
    expect(w.text()).toContain('Add the competition’s name.')

    await input(w, 'Name').setValue('Calgary Highland Games')
    await input(w, 'Date').setValue('2027-06-05')
    await stepper(w, 4).trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 2 of 4')
    expect(w.text()).toContain('Add the town or city.')
    expect(stepper(w, 2).attributes('aria-current')).toBe('step')
    expect(stepper(w, 1).attributes('aria-current')).toBeUndefined()

    await input(w, 'Town or city').setValue('Calgary, AB')
    await stepper(w, 4).trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 3 of 4')
    expect(w.text()).toContain('Add your name.')

    await input(w, 'Your name').setValue('Morag Ross')
    await stepper(w, 4).trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 4 of 4')

    await stepper(w, 1).trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 1 of 4')
    expect(value(w, 'Name')).toBe('Calgary Highland Games')
  })

  it('sends a picked venue with its map position, in the shape approval reads', async () => {
    const w = await begin()
    await toReview(w, { pick: TELUS })
    expect(w.text()).toContain('Telus Convention Centre')
    await w.find('[role=checkbox]').trigger('click')
    await next(w)

    expect(write).toHaveBeenCalledTimes(1)
    const sent = sentValue()
    expect(Object.keys(sent).sort()).toEqual(['competition', 'contact', 'submitted'])
    expect(sent.competition).toEqual({
      name: 'Calgary Highland Games',
      date: '2027-06-05',
      venue: 'Telus Convention Centre',
      address: '120 9 Ave SE',
      location: 'Calgary, AB',
      sobhd: null,
      description: null,
      lat: 51.04,
      lng: -114.06,
      country: 'CA',
      region: 'AB',
      locality: 'Calgary',
    })
    expect(sent.contact).toEqual({ name: 'Morag Ross', email: 'morag@example.test', message: null, disclaimer: true })
    expect(w.text()).toContain('Submitted')
  })

  it('a venue typed and not picked is sent as its name, with no map position', async () => {
    const w = await begin()
    await input(w, 'Name').setValue('Calgary Highland Games')
    await input(w, 'Date').setValue('2027-06-05')
    await next(w)
    await input(w, 'Venue').setValue('Glenmore Hall')
    await input(w, 'Town or city').setValue('Calgary, AB')
    await next(w)
    await input(w, 'Your name').setValue('Morag Ross')
    await next(w)
    await w.find('[role=checkbox]').trigger('click')
    await next(w)
    expect(sentValue().competition).not.toHaveProperty('lat')
    expect(sentValue().competition).toMatchObject({ venue: 'Glenmore Hall', location: 'Calgary, AB' })
  })

  it('picking a bare address fills the address, leaving the venue name blank', async () => {
    const w = await begin()
    await input(w, 'Name').setValue('Banff Games')
    await input(w, 'Date').setValue('2027-06-05')
    await next(w)
    await input(w, 'Venue').setValue('1 Main')
    w.findComponent(VenueField).vm.$emit('pick', { ...TELUS, venue: null, address: '1 Main St', location: 'Banff, AB' })
    await flushPromises()
    expect(value(w, 'Venue')).toBe('')
    expect(value(w, 'Address')).toBe('1 Main St')
    expect(value(w, 'Town or city')).toBe('Banff, AB')
  })

  it('asks for the tick before sending, and a double tap sends it once', async () => {
    const w = await begin()
    await toReview(w)
    await next(w)
    expect(w.text()).toContain('Tick this to continue.')
    expect(write).not.toHaveBeenCalled()

    await w.find('[role=checkbox]').trigger('click')
    const form = w.find('form')
    await Promise.all([form.trigger('submit'), form.trigger('submit')])
    await flushPromises()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('keeps a draft through a reload, past the overview, and forgets it once sent', async () => {
    const first = await begin()
    await input(first, 'Name').setValue('Calgary Highland Games')
    await input(first, 'Date').setValue('2027-06-05')
    await next(first)
    first.unmount()

    const w = render()
    await flushPromises()
    expect(w.text()).toContain('Picked up where you left off.')
    expect(w.text()).toContain('Step 2 of 4')
    await button(w, 'Back').trigger('click')
    await flushPromises()
    expect(value(w, 'Name')).toBe('Calgary Highland Games')

    await next(w)
    await input(w, 'Town or city').setValue('Calgary, AB')
    await next(w)
    await input(w, 'Your name').setValue('Morag Ross')
    await next(w)
    await w.find('[role=checkbox]').trigger('click')
    await next(w)
    expect(write).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('submit:draft:u1')).toBeNull()
  })

  it('Start over clears the draft', async () => {
    const first = await begin()
    await input(first, 'Name').setValue('Calgary Highland Games')
    first.unmount()

    const w = render()
    await flushPromises()
    await button(w, 'Start over').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 1 of 4')
    expect(value(w, 'Name')).toBe('')
    expect(w.text()).not.toContain('Picked up where you left off.')
    expect(localStorage.getItem('submit:draft:u1')).toBeNull()
  })

  it('Submit another starts afresh, keeping the venue and you', async () => {
    const w = await begin()
    await toReview(w, { pick: TELUS })
    await w.find('[role=checkbox]').trigger('click')
    await next(w)
    await button(w, 'Submit another').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Step 1 of 4')
    expect(value(w, 'Name')).toBe('')

    await input(w, 'Name').setValue('Calgary Highland Games, day 2')
    await input(w, 'Date').setValue('2027-06-06')
    await next(w)
    expect(value(w, 'Venue')).toBe('Telus Convention Centre')
    await next(w)
    expect(value(w, 'Your name')).toBe('Morag Ross')
  })
})
