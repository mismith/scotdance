import { at } from '@shared/util'
import { looksLikeLink, LINK_PROBLEM } from '@shared/links'

export interface SelectOption {
  value: string
  label: string
  group?: string
}

// Describes one editable list (dancers, age groups, dances…) for
// CollectionEditor: its fields, how rows read, presets and what deleting
// affects.

export interface FieldSpec {
  key: string
  label: string
  /** `dancers`: an entry's dancers, one row each (DancersField, ADR 0012). */
  kind: 'text' | 'textarea' | 'select' | 'image' | 'url' | 'dancers'
  required?: boolean
  hint?: string
  placeholder?: string
  inputmode?: 'text' | 'numeric' | 'url'
  options?: () => SelectOption[]
  /** Offer "Set {label}" when several rows are selected. */
  bulk?: boolean
  /** Sit beside the next half-width field on wide forms. */
  half?: boolean
  /**
   * Shown once it has a value, or when asked for with a "+ Add a routine"
   * button under the form (`addLabel`: "a routine"), so a form isn't a wall
   * of boxes to fill in.
   */
  optional?: boolean
  addLabel?: string
  /** Storage folder for images (Firebase Storage rules allow these). */
  storage?: 'staff' | 'info' | 'links'
  /** How it's saved ("3 & 1" as 3+1), said under the box while it differs from what's typed. */
  tidy?: (value: string) => string
  /** `values`: the rest of the form (or the saved item), e.g. to check a number within its age group. */
  validate?: (value: string, itemId: string | null, values: Record<string, unknown>) => string | null
  /** What's wrong with a list field's value on the add form, if anything. */
  check?: (value: unknown, values: Record<string, unknown>) => string | null
}

export interface CollectionItem {
  id: string
  label: string
  _order?: number
}

export interface CollectionSpec<T extends CollectionItem = CollectionItem> {
  /** Key under competitions:data/{id}. */
  path: 'dancers' | 'groups' | 'trophyEvents' | 'categories' | 'dances' | 'platforms' | 'staff'
  /** Route names for the list and a selected item. */
  route: string
  singular: string
  plural: string
  fields: FieldSpec[]
  /** Drag to reorder, saved as `_order`. */
  sortable?: boolean
  title: (item: T) => string
  subtitle?: (item: T) => string | null | undefined
  /** Under its title when open, if not the list's subtitle (which may repeat its fields). */
  detailSubtitle?: (item: T) => string | null | undefined
  /** A competitor-number tile at the start of the row. */
  badge?: (item: T) => string | null | undefined
  /** Extra text matched by search. */
  searchText?: (item: T) => string
  /** Quick-add starting values, given the previous added record. */
  defaults?: (previous: Record<string, string> | null) => Record<string, string>
  presets?: Array<{ label: string; values: Record<string, string> }>
  /** The line under the presets sheet's title. */
  presetsLead?: string
  /** A select field chosen once at the top of the presets sheet and given to each one added (an age group's category). */
  presetsScope?: string
  /** Empty, the way to start is importing the dancers, which creates these too. */
  importFirst?: boolean
  /**
   * The fields for one item, or for the add form's values, when the list
   * holds more than one kind (dancers and teams). Defaults to `fields`,
   * which must hold every field any kind has.
   */
  fieldsFor?: (values: Record<string, unknown>) => FieldSpec[]
  /** What one is called ("team"), by item or add form values. Defaults to `singular`. */
  singularFor?: (values: Record<string, unknown>) => string
  /** The record the add form saves. Defaults to its fields' values, trimmed, empty ones left out. */
  toRecord?: (values: Record<string, unknown>) => Record<string, unknown>
  /** Shown when the list is empty. */
  emptyHint?: string
}

export { looksLikeLink, LINK_PROBLEM }

export { at }

/** Previous values for a set of paths, so a change can be undone. */
export function snapshot(raw: unknown, updates: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(updates).map((p) => [p, at(raw, p) ?? null]))
}
