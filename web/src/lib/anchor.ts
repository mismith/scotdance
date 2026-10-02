// Where a small menu (Dialog variant="dropdown") opens beside the control
// that opened it: under it, right edges lined up, or above it when there
// isn't room below. Pass the result as the dialog's style.
export function anchorTo(el: Element | null | undefined, menuHeight = 220): Record<string, string> {
  if (!el) return {}
  const r = el.getBoundingClientRect()
  const right = `${Math.max(12, window.innerWidth - r.right)}px`
  if (r.bottom + 8 + menuHeight > window.innerHeight && r.top > menuHeight)
    return { top: 'auto', bottom: `${window.innerHeight - r.top + 6}px`, right, transformOrigin: 'bottom right' }
  return { top: `${r.bottom + 6}px`, right }
}
