import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'

// Adding a competition (ADR 0010): signed in only, an intro and then one
// question at a time, each with one button at its foot, sending the same
// shape as ever (the approval function reads it), with a draft that
// outlasts a reload.

const write = vi.fn(async (updates: Record<string, unknown>) => void updates)
vi.mock('@/lib/admin/write', () => ({
  write: (updates: Record<string, unknown>) => write(updates),
  newKey: () => 'sub1',
  friendlyError: (e: unknown) => String(e),
}))
vi.mock('@/lib/maps', () => ({ placesAvailable: true }))
// June 2027, so the date's month is the one the calendar opens on.
vi.mock('@/lib/now', async (original) => ({
  ...(await original<typeof import('@/lib/now')>()),
  now: () => new Date(2027, 5, 1, 10),
}))

const auth = reactive({
  authReady: true,
  isSignedIn: true,
  uid: 'u1' as string | null,
  openLogin: vi.fn(),
})
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
const me = reactive({
  email: 'morag@example.test',
  displayName: null as string | null,
  managedOrganisationIds: [] as string[],
})
vi.mock('@/stores/me', () => ({ useMeStore: () => me }))
const orgList = vi.hoisted(() => ({
  value: [] as Array<{ id: string; name: string; shortName?: string }>,
}))
vi.mock('@/composables/useOrganisations', () => ({
  useOrganisations: () => ({
    organisations: orgList,
    byId: {
      get value() {
        return new Map(orgList.value.map((o) => [o.id, o]))
      },
    },
    loaded: ref(true),
    error: ref(null),
    retry: () => {},
  }),
}))
// The region Competitions is showing.
const filter = { country: ref<string | null>('CA'), region: ref<string | null>(null) }
vi.mock('@/composables/useLocationFilter', () => ({ useLocationFilter: () => filter }))
vi.mock('@/lib/locale', () => ({ guessUserCountry: () => null }))
vi.mock('@/composables/usePageTitle', () => ({ usePageTitle: () => {} }))

// The venue search (tested on its own): types a name, or hands back a pick.
const VenueField = defineComponent({
  name: 'VenueField',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue', 'pick'],
  setup:
    (props, { emit }) =>
    () =>
      h('div', [
        h('label', { for: 'venue' }, 'Venue name'),
        h('input', {
          id: 'venue',
          value: props.modelValue,
          onInput: (e: Event) =>
            emit('update:modelValue', (e.target as HTMLInputElement).value),
        }),
      ]),
})
vi.mock('@/components/admin/VenueField.vue', () => ({ default: VenueField }))
// The bar, with the page's back button and progress in it (a stub's
// render function, so the page's own slots show).
const AppBar = { name: 'AppBar', render(this: { $slots: Record<string, (() => unknown) | undefined> }) { return h('nav', [this.$slots.leading?.(), this.$slots.middle?.()]) } }

const { default: Submit } = await import('@/views/competitions/Submit.vue')

type Wrapper = ReturnType<typeof mount>
const render = () => mount(Submit, { global: { stubs: { AppBar, RouterLink: true } } })
const slide = (w: Wrapper) => w.find('[data-slide]').attributes('data-slide-name') ?? null
const label = (w: Wrapper) =>
  w.find('main form > div:last-child button[type=submit]').text().trim()
const button = (w: Wrapper, text: string) =>
  w
    .findAll('button')
    .find((b) => b.text().trim() === text || b.attributes('aria-label') === text)!
const field = (w: Wrapper, name?: string) =>
  name
    ? w.find(
        `#${w
          .findAll('[data-slide] label')
          .find((l) => l.text().startsWith(name))!
          .attributes('for')}`,
      )
    : w.find('[data-slide] input[type=text]')
async function cont(w: Wrapper) {
  await w.find('main form').trigger('submit')
  await flushPromises()
}
/** A row on All good?, by its label. */
async function change(w: Wrapper, name: string) {
  await w
    .findAll('[data-slide] li button')
    .find((b) => b.find('span').text() === name)!
    .trigger('click')
  await flushPromises()
}
async function click(w: Wrapper, text: string) {
  await button(w, text).trigger('click')
  await flushPromises()
}
/** Past the intro, on the country. */
async function begin() {
  const w = render()
  await cont(w)
  return w
}
async function pickDay(w: Wrapper, day: number) {
  await w
    .findAll('[data-slide] button[aria-label]')
    .find((b) => b.attributes('aria-label')!.includes(`June ${day}, 2027`))!
    .trigger('click')
}
const sentValue = () =>
  write.mock.calls[0][0]['competitions:submissions/sub1'] as Record<
    string,
    Record<string, unknown>
  >

/** Every question with just what's needed (the venue picked, or a town typed), ending on All good? */
async function toReview(w: Wrapper, { pick }: { pick?: Record<string, unknown> } = {}) {
  await cont(w) // Canada, as chosen on Competitions
  await pickDay(w, 5)
  await cont(w)
  await field(w).setValue('Calgary Highland Games')
  await cont(w)
  await cont(w) // no organisation
  if (pick) w.findComponent(VenueField).vm.$emit('pick', pick)
  else {
    await click(w, 'Just the town for now')
    await field(w, 'Town or city').setValue('Calgary, AB')
  }
  await flushPromises()
  await cont(w)
  await cont(w) // no registration number
  await field(w).setValue('Morag Ross')
  await cont(w)
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
  Object.assign(me, { displayName: null, managedOrganisationIds: [] })
  filter.country.value = 'CA'
  filter.region.value = null
  localStorage.clear()
  orgList.value = []
})

describe('Add a competition', () => {
  it('signed out: the intro and a way in, but no questions or venue search', async () => {
    Object.assign(auth, { isSignedIn: false, uid: null })
    const w = render()
    await flushPromises()
    expect(w.text()).toContain('Add your competition')
    expect(w.text()).toContain('Free, and about 2 minutes.')
    expect(w.find('[data-slide]').exists()).toBe(false)
    expect(w.findComponent(VenueField).exists()).toBe(false)
    expect(label(w)).toBe('Sign in to start')
    await cont(w)
    expect(auth.openLogin).toHaveBeenCalledWith({ reason: 'submit' })

    // Signing in from there goes straight on to the first question.
    Object.assign(auth, { isSignedIn: true, uid: 'u1' })
    await flushPromises()
    expect(slide(w)).toBe('country')
  })

  it('signed in: the intro first, then the country, already on the one Competitions shows', async () => {
    const w = render()
    expect(label(w)).toBe('Start')
    expect(w.find('[data-slide]').exists()).toBe(false)
    await cont(w)
    expect(slide(w)).toBe('country')
    expect(w.text()).toContain('Which country is it in?')
    expect(w.find('[role=radio][aria-checked=true]').text()).toContain('Canada')
    expect(label(w)).toBe('Continue')
  })

  it('lists where Highland dancing competes A to Z, with the UK’s nations as their own', async () => {
    const w = await begin()
    expect(
      w.findAll('[role=radio]').map((r) =>
        r
          .text()
          .replace(/^\P{L}+/u, '')
          .trim(),
      ),
    ).toEqual([
      'Australia',
      'Canada',
      'England',
      'New Zealand',
      'Scotland',
      'South Africa',
      'United States',
    ])
    expect(w.text()).toContain('Another country')
  })

  it('starts on Scotland or England only when Competitions says which', async () => {
    filter.country.value = 'GB'
    let w = await begin()
    expect(w.find('[role=radio][aria-checked=true]').exists()).toBe(false)
    await cont(w)
    expect(slide(w)).toBe('country')
    expect(w.text()).toContain('Pick a country to continue.')
    w.unmount()

    filter.region.value = 'Scotland'
    w = await begin()
    expect(w.find('[role=radio][aria-checked=true]').text()).toContain('Scotland')
  })

  it('won’t move on from a question that needs an answer, and never says “required”', async () => {
    const w = await begin()
    await cont(w)
    expect(slide(w)).toBe('date')
    await cont(w)
    expect(slide(w)).toBe('date')
    expect(w.text()).toContain('Pick a date to continue.')
    await pickDay(w, 5)
    await flushPromises()
    expect(w.text()).not.toContain('Pick a date to continue.')
    expect(w.text()).toContain('Saturday, June 5, 2027')
    await cont(w)
    await cont(w)
    expect(slide(w)).toBe('name')
    expect(w.text()).toContain('Add its name to continue.')
    expect(w.text()).not.toContain('required')
  })

  it('an optional question says Skip until it’s answered, then Continue', async () => {
    const w = await begin()
    await toReview(w)
    await change(w, 'Registration')
    expect(slide(w)).toBe('registration')
    expect(label(w)).toBe('Back to review')
    w.unmount()

    localStorage.clear()
    const v = await begin()
    await cont(v)
    await pickDay(v, 5)
    await cont(v)
    await field(v).setValue('Calgary Highland Games')
    await cont(v)
    expect(slide(v)).toBe('organisation')
    expect(label(v)).toBe('Skip')
    await cont(v)
    await click(v, 'Just the town for now')
    await field(v, 'Town or city').setValue('Calgary, AB')
    await cont(v)
    expect(slide(v)).toBe('registration')
    expect(v.text()).toContain('From ScotDance Canada.')
    expect(label(v)).toBe('Skip')
    await field(v).setValue('c-ab-co-27-1234')
    expect(label(v)).toBe('Continue')
  })

  it('Back goes to the previous question, keeping what was typed', async () => {
    const w = await begin()
    await cont(w)
    await pickDay(w, 5)
    await cont(w)
    await field(w).setValue('Calgary Highland Games')
    await click(w, 'Back to the previous question')
    expect(slide(w)).toBe('date')
    await cont(w)
    expect((field(w).element as HTMLInputElement).value).toBe('Calgary Highland Games')
  })

  it('All good? lists every answer; changing one comes straight back', async () => {
    const w = await begin()
    await toReview(w)
    expect(slide(w)).toBe('review')
    const text = w.text()
    for (const s of [
      'Canada',
      'Sat, Jun 5, 2027',
      'Calgary Highland Games',
      'Calgary, AB',
      'Morag Ross',
      'morag@example.test',
      'Not added',
    ])
      expect(text).toContain(s)
    expect(label(w)).toBe('Send')

    await change(w, 'Name')
    expect(slide(w)).toBe('name')
    await field(w).setValue('Calgary Highland Games 2027')
    expect(label(w)).toBe('Back to review')
    await cont(w)
    expect(slide(w)).toBe('review')
    expect(w.text()).toContain('Calgary Highland Games 2027')
  })

  it('sends a picked venue with its map position, in the shape approval reads, with no description', async () => {
    const w = await begin()
    await toReview(w, { pick: TELUS })
    expect(w.text()).toContain('Telus Convention Centre')
    await w.find('[data-slide] [role=checkbox]').trigger('click')
    await cont(w)

    expect(write).toHaveBeenCalledTimes(1)
    const sent = sentValue()
    expect(Object.keys(sent).sort()).toEqual([
      'competition',
      'contact',
      'origin',
      'submitted',
    ])
    // (So its emails are v4's, linking back here.)
    expect(sent.origin).toBe(window.location.origin)
    expect(sent.competition).toEqual({
      name: 'Calgary Highland Games',
      date: '2027-06-05',
      venue: 'Telus Convention Centre',
      address: '120 9 Ave SE',
      location: 'Calgary, AB',
      sobhd: null,
      lat: 51.04,
      lng: -114.06,
      country: 'CA',
      region: 'AB',
      locality: 'Calgary',
    })
    expect(sent.contact).toEqual({
      name: 'Morag Ross',
      email: 'morag@example.test',
      message: null,
      disclaimer: true,
    })
    expect(w.text()).toContain('Sent')
  })

  it('a venue typed and not picked goes as its name, in the country asked, with no map position', async () => {
    filter.country.value = 'GB'
    filter.region.value = 'Scotland'
    const w = await begin()
    await cont(w)
    await pickDay(w, 5)
    await cont(w)
    await field(w).setValue('Cowal Highland Gathering')
    await cont(w)
    await cont(w)
    // Searched, but not picked: what's typed is the venue, and the town's still needed.
    await field(w, 'Venue name').setValue('Dunoon Stadium')
    await cont(w)
    expect(slide(w)).toBe('venue')
    expect(w.text()).toContain('Add the town or city to continue.')
    await field(w, 'Town or city').setValue('Dunoon')
    await cont(w)
    await cont(w)
    await field(w).setValue('Morag Ross')
    await cont(w)
    await w.find('[data-slide] [role=checkbox]').trigger('click')
    await cont(w)
    expect(sentValue().competition).not.toHaveProperty('lat')
    expect(sentValue().competition).toMatchObject({
      venue: 'Dunoon Stadium',
      location: 'Dunoon',
      country: 'GB',
      region: 'Scotland',
    })
  })

  it('picking a bare address fills the address, leaving the venue name blank', async () => {
    const w = await begin()
    await toReview(w, {
      pick: { ...TELUS, venue: null, address: '1 Main St', location: 'Banff, AB' },
    })
    expect(w.text()).toContain('1 Main St')
    await w.find('[data-slide] [role=checkbox]').trigger('click')
    await cont(w)
    expect(sentValue().competition).toMatchObject({
      venue: null,
      address: '1 Main St',
      location: 'Banff, AB',
    })
  })

  it('ticks the organisations its name mentions (as whole words), or the only one you run', async () => {
    orgList.value = [
      { id: 'chda', name: 'Calgary Highland Dancing Association', shortName: 'CHDA' },
      { id: 'cowal', name: 'Cowal Gathering' },
    ]
    const w = await begin()
    await cont(w)
    await pickDay(w, 5)
    await cont(w)
    await field(w).setValue('CHDAville Games')
    await cont(w)
    expect(w.findAll('[data-slide] [role=checkbox]')).toHaveLength(0)
    expect(label(w)).toBe('Skip')
    await click(w, 'Back to the previous question')
    w.unmount()

    localStorage.clear()
    const v = await begin()
    await cont(v)
    await pickDay(v, 5)
    await cont(v)
    await field(v).setValue('CHDA Fall Competition')
    await cont(v)
    const ticked = v.findAll('[data-slide] [role=checkbox][aria-checked=true]')
    expect(ticked.map((t) => t.text())).toEqual([
      expect.stringContaining('Calgary Highland Dancing Association'),
    ])
    expect(label(v)).toBe('Continue')
    // Untick it, and it's offered again.
    await ticked[0].trigger('click')
    expect(v.find('[data-slide] [role=checkbox][aria-checked=false]').text()).toContain(
      'Calgary Highland Dancing Association',
    )
    expect(label(v)).toBe('Skip')

    me.managedOrganisationIds = ['cowal']
    v.unmount()
    localStorage.clear()
    const x = await begin()
    await cont(x)
    await pickDay(x, 5)
    await cont(x)
    await field(x).setValue('Autumn Open')
    await cont(x)
    expect(x.find('[data-slide] [role=checkbox][aria-checked=true]').text()).toContain(
      'Cowal Gathering',
    )
  })

  it('asks for the tick before sending, and a double tap sends it once', async () => {
    const w = await begin()
    await toReview(w)
    await cont(w)
    expect(w.text()).toContain('Tick this to send it.')
    expect(write).not.toHaveBeenCalled()

    await w.find('[data-slide] [role=checkbox]').trigger('click')
    const form = w.find('main form')
    await Promise.all([form.trigger('submit'), form.trigger('submit')])
    await flushPromises()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('a message for the reviewer goes with it', async () => {
    const w = await begin()
    await toReview(w)
    await w.find('[data-slide] textarea').setValue('Is a pre-premier fine to list?')
    await w.find('[data-slide] [role=checkbox]').trigger('click')
    await cont(w)
    expect(sentValue().contact).toMatchObject({
      message: 'Is a pre-premier fine to list?',
    })
  })

  it('sending checks every answer: a draft reopened at All good? with no name goes back for it', async () => {
    localStorage.setItem(
      'submit:draft:u1',
      JSON.stringify({
        v: 2,
        form: {
          country: 'CA',
          date: '2027-06-05',
          location: 'Calgary, AB',
          contactName: 'Morag Ross',
          agree: true,
        },
        place: null,
        at: 'review',
        hosts: { ids: [], fresh: [] },
      }),
    )
    const w = render()
    await flushPromises()
    expect(label(w)).toBe('Pick up where you left off')
    await cont(w)
    expect(slide(w)).toBe('review')
    await cont(w)
    expect(write).not.toHaveBeenCalled()
    expect(slide(w)).toBe('name')
    expect(w.text()).toContain('Add its name to continue.')
    expect(label(w)).toBe('Back to review')
  })

  it('keeps a draft through a reload, offered on the intro, and forgets it once sent', async () => {
    const first = await begin()
    await cont(first)
    await pickDay(first, 5)
    await cont(first)
    await field(first).setValue('Calgary Highland Games')
    await cont(first)
    first.unmount()

    const w = render()
    await flushPromises()
    expect(label(w)).toBe('Pick up where you left off')
    await cont(w)
    expect(slide(w)).toBe('organisation')
    await click(w, 'Back to the previous question')
    expect((field(w).element as HTMLInputElement).value).toBe('Calgary Highland Games')

    await cont(w)
    await cont(w)
    await click(w, 'Just the town for now')
    await field(w, 'Town or city').setValue('Calgary, AB')
    await cont(w)
    await cont(w)
    await field(w).setValue('Morag Ross')
    await cont(w)
    await w.find('[data-slide] [role=checkbox]').trigger('click')
    await cont(w)
    expect(write).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('submit:draft:u1')).toBeNull()
  })

  it('an older draft, from the four steps, picks up at the first question', async () => {
    localStorage.setItem(
      'submit:draft:u1',
      JSON.stringify({
        form: { name: 'Calgary Highland Games', date: '2027-06-05', description: 'Old' },
        place: null,
        step: 2,
        hosts: { ids: [], fresh: [] },
      }),
    )
    const w = render()
    await flushPromises()
    await cont(w)
    expect(slide(w)).toBe('country')
    await cont(w)
    await cont(w)
    expect((field(w).element as HTMLInputElement).value).toBe('Calgary Highland Games')
  })

  it('Start over clears the draft', async () => {
    const first = await begin()
    await cont(first)
    await pickDay(first, 5)
    await cont(first)
    await field(first).setValue('Calgary Highland Games')
    first.unmount()

    const w = render()
    await flushPromises()
    await click(w, 'Start over')
    expect(slide(w)).toBe('country')
    await cont(w)
    await cont(w)
    expect(slide(w)).toBe('date')
    expect(localStorage.getItem('submit:draft:u1')).toBeNull()
  })

  it('Add another starts on the date, keeping the country, venue and you', async () => {
    const w = await begin()
    await toReview(w, { pick: TELUS })
    await w.find('[data-slide] [role=checkbox]').trigger('click')
    await cont(w)
    await click(w, 'Add another')
    expect(slide(w)).toBe('date')
    await pickDay(w, 6)
    await cont(w)
    expect((field(w).element as HTMLInputElement).value).toBe('')
    await field(w).setValue('Calgary Highland Games, day 2')
    await cont(w)
    await cont(w)
    expect(w.text()).toContain('Telus Convention Centre')
    await cont(w)
    await cont(w)
    expect((field(w).element as HTMLInputElement).value).toBe('Morag Ross')
  })

  it('keeps the slide a draft was left on through more than one reload', async () => {
    const first = await begin()
    await cont(first)
    await pickDay(first, 5)
    await cont(first)
    await field(first).setValue('Calgary Highland Games')
    await cont(first)
    first.unmount()

    // Opened and left twice without picking it up.
    render().unmount()
    const w = render()
    await flushPromises()
    await cont(w)
    expect(slide(w)).toBe('organisation')
  })

  it('a double tap moves on one question, not two', async () => {
    const w = await begin()
    await cont(w)
    await pickDay(w, 5)
    await cont(w)
    await field(w).setValue('Calgary Highland Games')
    const form = w.find('main form')
    await Promise.all([form.trigger('submit'), form.trigger('submit')])
    await flushPromises()
    expect(slide(w)).toBe('organisation')
  })

  it('Enter moves on from the question itself, as from a text box', async () => {
    const w = await begin()
    await w.find('#slide-question').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(slide(w)).toBe('date')
  })

  it('ticking and unticking an organisation keeps it in its place', async () => {
    orgList.value = [
      { id: 'chda', name: 'Calgary Highland Dancing Association', shortName: 'CHDA' },
      { id: 'cowal', name: 'Cowal Gathering' },
    ]
    me.managedOrganisationIds = ['cowal']
    const w = await begin()
    await cont(w)
    await pickDay(w, 5)
    await cont(w)
    await field(w).setValue('CHDA Fall Competition')
    await cont(w)
    const names = () => w.findAll('[data-slide] [role=checkbox]').map((b) => [b.text().includes('Calgary') ? 'chda' : 'cowal', b.attributes('aria-checked')])
    expect(names()).toEqual([
      ['chda', 'true'],
      ['cowal', 'false'],
    ])
    await w.findAll('[data-slide] [role=checkbox]')[0].trigger('click')
    expect(names()).toEqual([
      ['chda', 'false'],
      ['cowal', 'false'],
    ])
    await w.findAll('[data-slide] [role=checkbox]')[1].trigger('click')
    expect(names()).toEqual([
      ['chda', 'false'],
      ['cowal', 'true'],
    ])
  })

  it('a picked venue with no town of its own asks for the town', async () => {
    const w = await begin()
    await cont(w)
    await pickDay(w, 5)
    await cont(w)
    await field(w).setValue('Games on the Hill')
    await cont(w)
    await cont(w)
    w.findComponent(VenueField).vm.$emit('pick', { ...TELUS, venue: 'Hilltop Field', address: null, location: null, locality: null })
    await flushPromises()
    expect(w.text()).toContain('Hilltop Field')
    await cont(w)
    expect(slide(w)).toBe('venue')
    expect(w.text()).toContain('Add the town or city to continue.')
    await field(w, 'Town or city').setValue('Canmore, AB')
    await cont(w)
    expect(slide(w)).toBe('registration')
  })

  it('a town typed, then a search not picked from, keeps the town', async () => {
    const w = await begin()
    await cont(w)
    await pickDay(w, 5)
    await cont(w)
    await field(w).setValue('Calgary Highland Games')
    await cont(w)
    await cont(w)
    await click(w, 'Just the town for now')
    await field(w, 'Town or city').setValue('Calgary, AB')
    await click(w, 'Search for the venue')
    await cont(w)
    expect(slide(w)).toBe('registration')
  })

  it('shows a registration number as it’ll be saved, and checks once on one it can’t read', async () => {
    const w = await begin()
    await toReview(w)
    await change(w, 'Registration')
    await field(w).setValue('c ab co 27 1234')
    expect(w.text()).toContain('Registered with ScotDance Canada: C-AB-CO-27-1234')
    await cont(w)
    expect(slide(w)).toBe('review')
    expect(w.text()).toContain('C-AB-CO-27-1234')

    await change(w, 'Registration')
    await field(w).setValue('AB-1234-X')
    await cont(w)
    expect(slide(w)).toBe('registration')
    expect(w.text()).toContain('That doesn’t match the usual format, like C-AB-CO-27-1234.')
    expect(label(w)).toBe('Continue anyway')
    await cont(w)
    expect(slide(w)).toBe('review')
    expect(w.text()).toContain('AB-1234-X')
  })
})
