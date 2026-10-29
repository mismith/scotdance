import type { Unit } from '@/lib/print/model'

// Packs measured units into pages, top to bottom, so what's previewed is
// exactly what prints: a unit that doesn't fit starts the next page; a
// heading never sits alone at a page's foot; a table carried onto a new page
// gets its header again; a unit taller than a page gets one to itself (and
// is reported, as it will be cut off). Sideways units get sideways pages of
// their own, with the page's width to fill.

export interface Layout {
  pages: Unit[][]
  /** Units too tall for a page. */
  overflow: Unit[]
}

/** The units to measure: each one, and the headers they might repeat. */
export function measured(units: Unit[]): Unit[] {
  const seen = new Set<string>()
  const out: Unit[] = []
  for (const u of units) {
    for (const x of u.repeat ? [u, u.repeat] : [u]) {
      if (seen.has(x.key)) continue
      seen.add(x.key)
      out.push(x)
    }
  }
  return out
}

/** `available`: the height for units on a page, upright and sideways. */
export function paginate(units: Unit[], heights: Map<string, number>, available: { upright: number; sideways: number }): Layout {
  const h = (u: Unit) => heights.get(u.key) ?? 0
  const pages: Unit[][] = []
  const overflow: Unit[] = []
  let page: Unit[] = []
  let used = 0
  let sideways = false
  const close = () => {
    if (page.length) pages.push(page)
    page = []
    used = 0
  }

  units.forEach((u, i) => {
    if (u.fullPage) {
      close()
      if (h(u) > available.upright) overflow.push(u)
      pages.push([u])
      return
    }
    if (u.breakBefore || (page.length && !!u.rotate !== sideways)) close()
    if (!page.length) sideways = !!u.rotate
    const room = sideways ? available.sideways : available.upright

    // A heading takes what it heads along with it.
    let need = h(u)
    if (u.keepWithNext) {
      for (let j = i + 1; j < units.length; j++) {
        const next = units[j]
        if (next.fullPage || next.breakBefore) break
        need += h(next)
        if (!next.keepWithNext) break
      }
    }
    // (Headings alone on a page stay with what they head, even when it's too long to fit.)
    if (page.length && used + need > room && !page.every((x) => x.keepWithNext)) close()

    // Carried over: the table's header (or "continued") first.
    if (!page.length && u.repeat && pages.length && units[i - 1]?.repeat?.key === u.repeat.key) {
      page.push(u.repeat)
      used += h(u.repeat)
    }
    if (used + h(u) > room) overflow.push(u)
    page.push(u)
    used += h(u)
  })
  close()
  return { pages, overflow }
}
