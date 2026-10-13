import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'

// Adding a competition (ADR 0010): signed in only, an intro and then one
// question at a time, each with one button at its foot, sending the same
// shape as ever (the approval function reads it), with a draft that
// outlasts a reload. After the date, "Is it one of these?" (ADR 0009) when
// something's known that day, and "Another competition that weekend?" once
// it's sent.

const write = vi.fn(async (updates: Record<string, unknown>) => void updates)
vi.mock('@/lib/admin/write', () => ({
  write: (updates: Record<string, unknown>) => write(updates),
  newKey: () => 'sub1',
  friendlyError: (e: unknown) => String(e),
}))
vi.mock('@/lib/maps', () => ({ placesAvailable: true }))
// What the lookups on the date find (knownCompetitions and competitions, by
// date), in place of the database.
const db = vi.hoisted(() => ({ data: {} as Record<string, Record<string, { date?: string }>> }))
type Lookup = { lookup: true; path: string; from: string; to: string }
vi.mock('@/firebase', async (original) => ({
  ...(await original<typeof import('@/firebase')>()),
  dataRef: (path: string) => ({ lookup: true, path }),
}))
vi.mock('firebase/database', async (original) => {
  const real = await original<typeof import('firebase/database')>()
  return {
    ...real,
    query: (ref: Lookup, ...bounds: object[]) => Object.assign({}, ref, ...bounds),
    orderByChild: () => ({}),
    startAt: (from: string) => ({ from }),
    endAt: (to: string) => ({ to }),
    get: async (q: Lookup) => {
      if (!q?.lookup) return real.get(q as never)
      const found = Object.entries(db.data[q.path] ?? {}).filter(([, v]) => v.date && v.date >= q.from && v.date <= q.to)
      return { val: () => (found.length ? Object.fromEntries(found) : null) }
    },
  }
})
const confirmAnswer = vi.hoisted(() => ({ value: false, asked: [] as unknown[] }))
vi.mock('@/lib/admin/feedback', () => ({
  confirm: async (opts: unknown) => {
    confirmAnswer.asked.push(opts)
    return confirmAnswer.value
  },
}))
const push = vi.fn()
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
}))
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
  managedCompetitionIds: [] as string[],
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
  Object.assign(me, { displayName: null, managedOrganisationIds: [], managedCompetitionIds: [] })
  db.data = {}
  confirmAnswer.value = false
  confirmAnswer.asked = []
  push.mockClear()
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

  // --- Is it one of these? (ADR 0009)

  const KNOWN = {
    source: 'sdc',
    date: '2027-06-05',
    end: '2027-06-06',
    name: 'Calgary Highland Games',
    venue: 'Spruce Meadows',
    address: '18011 Spruce Meadows Way SW',
    locality: 'Calgary',
    region: 'AB',
    country: 'CA',
    website: 'https://example.test/games',
    organisations: { o1: true },
  }
  /** On to "Is it one of these?" (or past it), from the country. */
  async function toMatches(w: Wrapper, day = 5) {
    await cont(w)
    await pickDay(w, day)
    await cont(w)
  }
  const rowButton = (w: Wrapper, name: string) =>
    w.findAll('[data-slide] li button').find((b) => b.text().includes(name))!

  it('with nothing known that day, goes straight from the date to the name', async () => {
    db.data = { knownCompetitions: { k1: { ...KNOWN, date: '2027-06-12', end: undefined } } }
    const w = await begin()
    await toMatches(w)
    expect(slide(w)).toBe('name')
    // (Back passes it by too.)
    await click(w, 'Back to the previous question')
    expect(slide(w)).toBe('date')
  })

  it('asks "Is it one of these?" when something’s known that day, and None of these carries on to the name', async () => {
    db.data = { knownCompetitions: { k1: KNOWN } }
    const w = await begin()
    await toMatches(w)
    expect(slide(w)).toBe('match')
    expect(w.text()).toContain('Is it one of these?')
    expect(w.text()).toContain('Step 3 of 9')
    // Its days and town, and (in small print) which list it's from.
    // (The range as the locale writes it, thin spaces and all.)
    expect(w.text()).toMatch(/Jun 5\s–\s6 · Calgary, AB/)
    expect(w.text()).toContain('From ScotDance Canada')
    expect(w.text()).not.toContain('Spruce Meadows')
    expect(label(w)).toBe('None of these')
    await cont(w)
    expect(slide(w)).toBe('name')
    expect(w.text()).toContain('Step 4 of 9')
    await click(w, 'Back to the previous question')
    expect(slide(w)).toBe('match')
  })

  it('only offers what’s in the country chosen, or doesn’t say', async () => {
    db.data = {
      knownCompetitions: { k1: KNOWN, k2: { ...KNOWN, name: 'Stone Mountain Games', country: 'US' } },
      competitions: { c1: { name: 'Spokane Games', date: '2027-06-05', country: 'US' }, c2: { name: 'Winnipeg Open', date: '2027-06-04' } },
    }
    const w = await begin()
    await toMatches(w)
    expect(w.text()).toContain('Calgary Highland Games')
    expect(w.text()).toContain('Winnipeg Open')
    expect(w.text()).not.toContain('Stone Mountain Games')
    expect(w.text()).not.toContain('Spokane Games')
  })

  it('picking a known one fills in what it knows, its organisation too, and goes to what’s left', async () => {
    db.data = { knownCompetitions: { k1: KNOWN } }
    orgList.value = [{ id: 'o1', name: 'Calgary Highland Dance Association' }]
    const w = await begin()
    await toMatches(w)
    await rowButton(w, 'Calgary Highland Games').trigger('click')
    await flushPromises()
    // Your name's still needed: then back to the last look.
    expect(slide(w)).toBe('contact')
    expect(label(w)).toBe('Back to review')
    await field(w).setValue('Morag Ross')
    await cont(w)
    expect(slide(w)).toBe('review')
    for (const text of ['Calgary Highland Games', 'Calgary Highland Dance Association', 'Spruce Meadows', '18011 Spruce Meadows Way SW', 'Calgary, AB'])
      expect(w.text()).toContain(text)
    // (Not its website: Add a competition doesn't ask for links.)
    expect(w.text()).not.toContain('example.test/games')
    await w.find('[role=checkbox]').trigger('click')
    await cont(w)
    const sent = sentValue()
    expect(sent.competition).toMatchObject({
      name: 'Calgary Highland Games',
      venue: 'Spruce Meadows',
      address: '18011 Spruce Meadows Way SW',
      location: 'Calgary, AB',
      country: 'CA',
    })
    expect(sent.competition.links).toBeUndefined()
    expect(sent.organisations).toEqual({ o1: true })
  })

  it('tapping the pick again puts back what was there, but not what’s been typed since', async () => {
    db.data = { knownCompetitions: { k1: KNOWN } }
    const w = await begin()
    await toMatches(w)
    await cont(w) // None of these
    await field(w).setValue('My Own Games')
    await click(w, 'Back to the previous question')
    expect(slide(w)).toBe('match')
    await rowButton(w, 'Calgary Highland Games').trigger('click')
    await flushPromises()
    await field(w).setValue('Morag Ross')
    await cont(w)
    expect(slide(w)).toBe('review')
    expect(w.text()).toContain('Calgary Highland Games')
    for (const to of ['contact', 'registration', 'venue', 'organisation', 'name', 'match']) {
      await click(w, 'Back to the previous question')
      expect(slide(w)).toBe(to)
    }
    expect(rowButton(w, 'Calgary Highland Games').attributes('aria-pressed')).toBe('true')
    expect(label(w)).toBe('Continue')
    await rowButton(w, 'Calgary Highland Games').trigger('click')
    await flushPromises()
    expect(slide(w)).toBe('match')
    expect(rowButton(w, 'Calgary Highland Games').attributes('aria-pressed')).toBe('false')
    expect(label(w)).toBe('None of these')
    await cont(w)
    expect((field(w).element as HTMLInputElement).value).toBe('My Own Games')
    await cont(w)
    await cont(w)
    expect(slide(w)).toBe('venue')
    expect(w.text()).not.toContain('Spruce Meadows')
    await click(w, 'Just the town for now')
    await field(w, 'Town or city').setValue('Calgary, AB')
    await cont(w)
    await cont(w)
    expect((field(w).element as HTMLInputElement).value).toBe('Morag Ross')
  })

  it('one already here says so, with a way to it', async () => {
    db.data = { competitions: { c1: { name: 'Calgary Highland Games', date: '2027-06-05', location: 'Calgary, AB', country: 'CA' } as never } }
    const w = await begin()
    await toMatches(w)
    expect(w.text()).toContain('Already on ScotDance.app')
    await rowButton(w, 'Calgary Highland Games').trigger('click')
    await flushPromises()
    expect(confirmAnswer.asked).toEqual([
      expect.objectContaining({ title: 'It’s already on ScotDance.app', confirmLabel: 'Open it', cancelLabel: 'It’s a different one' }),
    ])
    expect(push).not.toHaveBeenCalled()
    expect(slide(w)).toBe('match')
    confirmAnswer.value = true
    await rowButton(w, 'Calgary Highland Games').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith({ name: 'competition.info', params: { competitionId: 'c1' } })
  })

  it('a known one that’s already here is offered only as already here', async () => {
    db.data = { knownCompetitions: { k1: KNOWN }, competitions: { c1: { name: 'Calgary Highland Games', date: '2027-06-05', venue: 'Spruce Meadows', location: 'Calgary, AB' } as never } }
    const w = await begin()
    await toMatches(w)
    expect(w.text()).not.toContain('From ScotDance Canada’s event list')
    expect(w.text()).toContain('Already on ScotDance.app')
  })

  it('yours from last year: the same again, a year on, without its registration number or links', async () => {
    me.managedCompetitionIds = ['c1']
    me.displayName = 'Morag Ross'
    db.data = {
      competitions: {
        c1: { ...TELUS, name: 'Calgary Games 2026', date: '2026-06-13', organisations: { o1: true }, links: { l1: { name: 'Program', url: 'https://example.test/p.pdf' } }, sobhd: 'C-AB-CO-26-1234' } as never,
        // Not yours.
        c2: { name: 'Someone Else’s Games', date: '2026-06-06' },
      },
    }
    orgList.value = [{ id: 'o1', name: 'Calgary Highland Dance Association' }]
    const w = await begin()
    await toMatches(w)
    expect(w.text()).toContain('Yours last year')
    expect(w.text()).not.toContain('Someone Else’s Games')
    expect(w.text()).toContain('Jun 13, 2026')
    await rowButton(w, 'Calgary Games 2026').trigger('click')
    await flushPromises()
    expect(slide(w)).toBe('review')
    expect(w.text()).toContain('Calgary Games 2027')
    await w.find('[role=checkbox]').trigger('click')
    await cont(w)
    const sent = sentValue()
    expect(sent.competition).toMatchObject({ ...TELUS, name: 'Calgary Games 2027', date: '2027-06-05' })
    expect(sent.competition.sobhd).toBeNull()
    expect(sent.competition.links).toBeUndefined()
    expect(sent.organisations).toEqual({ o1: true })
  })

  it('keeps a pick through a reload, asking again from the date', async () => {
    db.data = { knownCompetitions: { k1: KNOWN } }
    let w = await begin()
    await toMatches(w)
    await rowButton(w, 'Calgary Highland Games').trigger('click')
    await flushPromises()
    w.unmount()
    w = render()
    await flushPromises()
    await cont(w) // Pick up where you left off
    expect(slide(w)).toBe('contact')
    // (Not looked up again yet, so Back passes it by.)
    for (const to of ['registration', 'venue', 'organisation', 'name', 'date']) {
      await click(w, 'Back to the previous question')
      expect(slide(w)).toBe(to)
    }
    await cont(w)
    expect(slide(w)).toBe('match')
    expect(rowButton(w, 'Calgary Highland Games').attributes('aria-pressed')).toBe('true')
  })

  // --- Another competition that weekend (ADR 0009)

  it('asks for another competition that weekend: the next day, linked with this one', async () => {
    me.displayName = 'Morag Ross'
    const w = await begin()
    await toReview(w, { pick: TELUS })
    await w.find('[role=checkbox]').trigger('click')
    await cont(w)
    expect(w.text()).toContain('Another competition that weekend?')
    await click(w, 'Add Sunday, Jun 6')
    expect(slide(w)).toBe('date')
    expect(w.text()).toContain('Sunday, June 6, 2027')
    await cont(w)
    expect(slide(w)).toBe('name')
    await field(w).setValue('Calgary Highland Games Day 2')
    await cont(w)
    await cont(w)
    // The venue and you carry over.
    expect(w.text()).toContain('Telus Convention Centre')
    await cont(w)
    await cont(w)
    expect((field(w).element as HTMLInputElement).value).toBe('Morag Ross')
    await cont(w)
    expect(slide(w)).toBe('review')
    expect(w.text()).toContain('Linked with Calgary Highland Games once both are approved.')
    await w.find('[role=checkbox]').trigger('click')
    await cont(w)
    const second = write.mock.calls[1][0]['competitions:submissions/sub1'] as Record<string, Record<string, unknown>>
    expect(second.linkedTo).toBe('sub1')
    expect(second.competition).toMatchObject({ name: 'Calgary Highland Games Day 2', date: '2027-06-06', venue: 'Telus Convention Centre' })
  })

  it('Add another isn’t linked', async () => {
    me.displayName = 'Morag Ross'
    const w = await begin()
    await toReview(w)
    await w.find('[role=checkbox]').trigger('click')
    await cont(w)
    await click(w, 'Add another')
    await pickDay(w, 12)
    await cont(w)
    await field(w).setValue('Calgary Fall Games')
    for (let i = 0; i < 5; i++) await cont(w)
    expect(w.text()).not.toContain('Linked with')
  })
})
