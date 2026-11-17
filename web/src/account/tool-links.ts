import { TOOLS, type Audience } from '@/connect/protocol'
import { formatMonthDay, formatShortDate, isSameDay } from '@/lib/format'
export { TOOLS, type Audience }

export interface ToolLink {
  linkedAt?: number
  signedInAt?: number
}

/** Their linked tools, in the order TOOLS lists them. */
export function linkedTools(value: unknown): { tool: Audience; link: ToolLink }[] {
  const links = (value && typeof value === 'object' ? value : {}) as Record<string, ToolLink>
  return (Object.keys(TOOLS) as Audience[]).filter((tool) => links[tool]).map((tool) => ({ tool, link: links[tool]! }))
}

/** "today", "12 Oct", or "12 Oct 2025" in another year. */
export function toolDate(ms: number | undefined): string {
  if (!ms) return ''
  if (isSameDay(ms)) return 'today'
  return new Date(ms).getFullYear() === new Date().getFullYear() ? formatMonthDay(ms) : formatShortDate(ms)
}

