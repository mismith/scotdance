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
  kind: 'text' | 'textarea' | 'select' | 'image' | 'url'
  required?: boolean
  hint?: string
  placeholder?: string
  inputmode?: 'text' | 'numeric' | 'url'
  options?: () => SelectOption[]
  /** Offer "Set {label}" when several rows are selected. */
  bulk?: boolean
  /** Sit beside the next half-width field on wide forms. */
  half?: boolean
  /** Storage folder for images (Firebase Storage rules allow these). */
  storage?: 'staff' | 'info' | 'links'
  /** `values`: the rest of the form (or the saved item), e.g. to check a number within its age group. */
  validate?: (value: string, itemId: string | null, values: Record<string, unknown>) => string | null
}

export interface CollectionItem {
  id: string
  label: string
  _order?: number
}

export interface DeleteImpact {
  /** Extra paths (relative to competitions:data/{id}) to change alongside the delete. */
  updates?: Record<string, unknown>
  /** Plain-language consequences, shown in the confirmation. */
  warnings?: string[]
}

export interface CollectionSpec<T extends CollectionItem = CollectionItem> {
  /** Key under competitions:data/{id}. */
  path: 'dancers' | 'groups' | 'categories' | 'dances' | 'platforms' | 'staff'
  /** Route names for the list and a selected item. */
  route: string
  singular: string
  plural: string
  fields: FieldSpec[]
  /** Drag to reorder, saved as `_order`. */
  sortable?: boolean
  title: (item: T) => string
  subtitle?: (item: T) => string | null | undefined
  /** A competitor-number tile at the start of the row. */
  badge?: (item: T) => string | null | undefined
  /** Extra text matched by search. */
  searchText?: (item: T) => string
  /** Quick-add starting values, given the previous added record. */
  defaults?: (previous: Record<string, string> | null) => Record<string, string>
  presets?: Array<{ label: string; values: Record<string, string> }>
  /** Extra writes when a field changes (e.g. a dancer's category follows their age group). */
  onChange?: (item: T, key: string, value: string | null) => Record<string, unknown>
  /** What deleting these rows affects. */
  impact?: (ids: string[]) => DeleteImpact
  /** Shown when the list is empty. */
  emptyHint?: string
}

/** Read a value at a slash path from a nested object. */
export function at(obj: unknown, path: string): unknown {
  return path.split('/').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

/** Previous values for a set of paths, so a change can be undone. */
export function snapshot(raw: unknown, updates: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(updates).map((p) => [p, at(raw, p) ?? null]))
}
