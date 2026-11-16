/** Hosted UI only. Credentials and authenticated persistence remain in the calling app. */
const CHANNEL = 'scotdance:dancer-editor:v1'
const ORIGIN = new URL(import.meta.url).origin
let active = false
export function openDancerEditor({ load, save, signal, opener: requestedOpener }) {
  if (active) return Promise.reject(new Error('A dancer editor is already open.'))
  if (signal?.aborted) return Promise.resolve(undefined)
  active = true
  return new Promise((resolve, reject) => {
    const session = crypto.randomUUID()
    const opener = requestedOpener || document.activeElement
    const overflow = document.documentElement.style.overflow
    const dialog = document.createElement('dialog')
    dialog.setAttribute('aria-label', 'ScotDance Connect')
    dialog.dataset.scotdanceEditor = ''
    const style = document.createElement('style')
    style.textContent = `dialog[data-scotdance-editor]::backdrop{background:transparent}
      [data-connect-editor-loading]{color:transparent!important}
      [data-connect-editor-loading]>*{visibility:hidden}
      [data-connect-editor-loading]>[data-connect-editor-spinner]{visibility:visible;position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
      [data-connect-editor-spinner]::before{content:"";width:1em;height:1em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:connect-editor-spin .7s linear infinite}
      @keyframes connect-editor-spin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){[data-connect-editor-spinner]::before{animation:none}}`
    document.head.append(style)
    Object.assign(dialog.style, { position: 'fixed', inset: '0', width: '100vw', height: '100dvh', maxWidth: 'none', maxHeight: 'none', margin: '0', padding: '0', border: '0', background: 'transparent', overflow: 'hidden', display: 'block', visibility: 'hidden' })
    const host = document.createElement('div')
    dialog.append(host)
    const shadow = host.attachShadow({ mode: 'open' })
    // Give the hidden frame its final viewport to lay out the form. No loading surface
    // or modal is shown until the editor's ready message includes loaded fields/fonts.
    shadow.innerHTML = `<style>iframe{position:absolute;inset:0;width:100%;height:100%;border:0;visibility:hidden}</style><iframe title="ScotDance Connect" referrerpolicy="origin"></iframe>`
    const frame = shadow.querySelector('iframe')
    let ended = false, writing = false, context, lastResult, initialized = false, revealed = false
    const button = opener instanceof HTMLButtonElement ? opener : null
    const previousBusy = button?.getAttribute('aria-busy')
    const previousPosition = button?.style.position
    let spinner
    button?.setAttribute('aria-busy', 'true')
    // Quick opens need no indicator. Slow opens use the existing button without
    // changing its size, accessible name or the page's focus/scroll position.
    const spinnerTimer = setTimeout(() => {
      if (!button?.isConnected) return
      spinner = document.createElement('span')
      spinner.dataset.connectEditorSpinner = ''
      spinner.setAttribute('aria-hidden', 'true')
      spinner.style.color = getComputedStyle(button).color
      if (getComputedStyle(button).position === 'static') button.style.position = 'relative'
      button.dataset.connectEditorLoading = ''
      button.append(spinner)
    }, 200)
    function clearOpeningIndicator() {
      clearTimeout(spinnerTimer)
      spinner?.remove()
      if (!button) return
      delete button.dataset.connectEditorLoading
      button.style.position = previousPosition
      if (previousBusy === null) button.removeAttribute('aria-busy')
      else button.setAttribute('aria-busy', previousBusy)
    }
    let timeout = setTimeout(() => finish(new Error('ScotDance Connect did not open. Please try again.')), 20000)
    function send(type, values = {}) { frame.contentWindow?.postMessage({ channel: CHANNEL, session, type, ...values }, ORIGIN) }
    function finish(error) {
      if (ended) return
      ended = true; active = false
      clearTimeout(timeout)
      clearOpeningIndicator()
      window.removeEventListener('message', receive)
      signal?.removeEventListener('abort', abort)
      document.removeEventListener('keydown', cancelPending, true)
      dialog.close(); dialog.remove(); style.remove()
      if (revealed) {
        document.documentElement.style.overflow = overflow
        requestAnimationFrame(() => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true }) })
      }
      if (error) reject(error); else resolve(lastResult)
    }
    function abort() { finish() }
    function cancelPending(event) {
      if (!revealed && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish() }
    }
    async function receive(event) {
      if (ended || event.source !== frame.contentWindow || event.origin !== ORIGIN) return
      const data = event.data
      if (!data || data.channel !== CHANNEL || data.session !== session) return
      if (data.type === 'hello' && !initialized) {
        initialized = true
        try { context = await load(); if (!ended) send('init', { context }) }
        catch (error) { finish(error) }
      } else if (data.type === 'ready' && context && !revealed) {
        clearTimeout(timeout)
        clearOpeningIndicator()
        revealed = true
        frame.style.colorScheme = data.scheme === 'dark' ? 'dark' : 'light'
        frame.style.visibility = 'visible'
        dialog.style.visibility = 'visible'
        dialog.showModal()
        document.documentElement.style.overflow = 'hidden'
        frame.focus()
      } else if (data.type === 'write' && context && !writing) {
        const write = data.write
        if (!write || !['save', 'delete'].includes(write.action) || typeof write.requestId !== 'string' || !write.dancer || typeof write.dancer.id !== 'string') return
        if (context.dancer && (write.dancer.id !== context.dancer.id || write.dancer.revision !== context.dancer.revision)) return
        if (!context.dancer && (write.action === 'delete' || write.dancer.revision !== 0)) return
        writing = true
        try {
          lastResult = await save({ ...write, defaultsRevision: context.defaultsRevision })
          if (!ended) send('result', { requestId: write.requestId, result: lastResult })
        } catch (error) { if (!ended) send('result', { requestId: write.requestId, error: error instanceof Error ? error.message : 'Could not save. Please try again.' }) }
        finally { writing = false }
      } else if (data.type === 'closed' && !writing) finish()
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!context && !writing) finish() })
    signal?.addEventListener('abort', abort, { once: true })
    window.addEventListener('message', receive)
    document.addEventListener('keydown', cancelPending, true)
    document.body.append(dialog)
    frame.src = `${ORIGIN}/dancer-editor.html?parent=${encodeURIComponent(location.origin)}&session=${session}`
  })
}
