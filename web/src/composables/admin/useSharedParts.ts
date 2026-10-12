import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useLinkSync, useLinkedSet } from '@/composables/useCompetitionLinks'
import { LINK_PART_IDS, type LinkPart } from '@/lib/linked'
import { useMorph } from '@/lib/morph'
import { useMeStore } from '@/stores/me'

/**
 * For Manage: what a linked competition shares from its main one (ADR 0007).
 * A shared part is changed on the main one, so Manage shows it, not edits it
 * (the rules refuse those writes anyway).
 */
export function useSharedParts(competitionId: Ref<string>) {
  const me = useMeStore()
  const { takes } = useLinkSync()
  const { members, primary } = useLinkedSet(competitionId)
  const mainId = computed(() => primary.value)
  const mainRecord = computed(() => members.value.find((c) => c.id === mainId.value) ?? null)
  const mainName = computed(() => mainRecord.value?.name?.trim() || 'the main one')
  /** Linked, and not the main one itself. */
  const isOther = computed(() => !!mainId.value && mainId.value !== competitionId.value)
  const shared = (part: LinkPart) => isOther.value && takes(competitionId.value, part)
  const anyShared = computed(() => LINK_PART_IDS.some(shared))
  /** The main one: its Manage page (`section`, with `params`) when you manage it, else its own page. */
  const mainTo = (section = 'manage.details', params: Record<string, string> = {}): RouteLocationRaw | null => {
    const id = mainId.value
    if (!id) return null
    return me.hasCompetitionPerm(id) ? { name: section, params: { competitionId: id, ...params } } : { name: 'competition.info', params: { competitionId: id } }
  }
  return { mainId, mainRecord, mainName, isOther, shared, anyShared, mainTo }
}

export type SharedSheet = ReturnType<typeof useSharedParts> & {
  competitionId: Ref<string>
  morph: ReturnType<typeof useMorph>
  /** The part being explained. */
  part: Ref<LinkPart | null>
  /** Tapping anything locked: why, and the ways out (SharedSheet.vue). */
  explain: (part: LinkPart, from?: Event | HTMLElement | null) => void
}
const KEY: InjectionKey<SharedSheet> = Symbol('sharedSheet')

/**
 * A Manage page with shared parts: everything locked on it opens the one
 * Shared sheet (render SharedSheet.vue once on the page).
 */
export function provideSharedSheet(competitionId: Ref<string>): SharedSheet {
  const morph = useMorph()
  const part = ref<LinkPart | null>(null)
  const sheet: SharedSheet = {
    ...useSharedParts(competitionId),
    competitionId,
    morph,
    part,
    explain: (p, from) => {
      part.value = p
      morph.show(from)
    },
  }
  provide(KEY, sheet)
  return sheet
}

export const useSharedSheet = () => inject(KEY, null)
