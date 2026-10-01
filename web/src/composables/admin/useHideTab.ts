import { computed } from 'vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { confirm, toast } from '@/lib/admin/feedback'
import { friendlyError } from '@/lib/admin/write'

// Hiding the Schedule or Results tab, for competitions that won't use it
// here. Hiding deletes what's been entered in it (after asking, and it can
// be undone); showing it again starts from nothing.

export type HideableTab = 'schedule' | 'results'

const TABS = {
  schedule: {
    name: 'Schedule',
    deletes: 'The schedule built so far is deleted',
  },
  results: {
    name: 'Results',
    deletes: 'All results entered so far are deleted',
  },
}

export function useHideTab(tab: HideableTab) {
  const m = useManagedCompetition()
  const { name, deletes } = TABS[tab]
  const hidden = computed(() =>
    tab === 'schedule' ? m.scheduleHidden.value : m.resultsHidden.value,
  )
  const hasAny = () =>
    tab === 'schedule'
      ? Object.keys(m.schedule.value?.days ?? {}).length > 0
      : Object.keys(m.results.value).length > 0

  async function hide() {
    const any = hasAny()
    const ok = await confirm({
      title: `Hide the ${name} tab?`,
      message: any
        ? `${deletes}, and the tab disappears from the competition page.`
        : 'The tab disappears from the competition page.',
      confirmLabel: `Hide ${tab}`,
      destructive: any,
    })
    if (!ok) return
    try {
      const change = await m.writeData({ [tab]: false }, `Hid the ${name} tab`)
      toast(`${name} tab hidden`, {
        action: { label: 'Undo', run: () => m.undoChange(change) },
      })
    } catch (e) {
      toast(friendlyError(e), { tone: 'error' })
    }
  }

  async function show() {
    try {
      await m.writeData({ [tab]: null }, `Showed the ${name} tab`)
    } catch (e) {
      toast(friendlyError(e), { tone: 'error' })
    }
  }

  return { name, hidden, hide, show }
}
