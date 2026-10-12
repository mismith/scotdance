import { computed, type Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useLinkSync, useLinkedSet } from '@/composables/useCompetitionLinks'
import { LINK_PART_IDS, type LinkPart } from '@/lib/linked'
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
