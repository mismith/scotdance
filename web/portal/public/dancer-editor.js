/** Hosted UI only. Credentials and authenticated persistence remain in the calling app. */
const CHANNEL = 'scotdance:dancer-editor:v1'
const ORIGIN = new URL(import.meta.url).origin
let active = false
export function openDancerEditor({ load, save, manageAccess, verifyEmail, signal, opener: requestedOpener }) {
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
    let ended = false, changing = 0, changes = Promise.resolve(), context, lastResult, initialized = false, revealed = false
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
    function queue(task) {
      changing++
      changes = changes.then(task).catch(() => {}).finally(() => { changing-- })
    }
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
        try { context = await load(); if (!ended) send('init', { context: { ...context, canManageAccess: typeof manageAccess === 'function', canVerifyEmail: typeof verifyEmail === 'function' } }) }
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
      } else if (data.type === 'write' && context && typeof data.write?.requestId === 'string') {
        const write = data.write
        const problem = writeProblem(write)
        if (problem) return send('result', { requestId: write.requestId, error: problem })
        // Changes run one at a time, in order; each one always gets a reply.
        queue(async () => {
          try {
            lastResult = await save({ ...write, defaultsRevision: context.defaultsRevision })
            if (!ended) send('result', { requestId: write.requestId, result: lastResult })
          } catch (error) { if (!ended) send('result', { requestId: write.requestId, error: error instanceof Error ? error.message : 'Could not save. Please try again.' }) }
        })
      } else if (data.type === 'access' && context && typeof data.requestId === 'string') {
        const request = data.request
        const problem = accessProblem(request)
        if (problem) return send('access-result', { requestId: data.requestId, error: problem })
        const run = async () => {
          try {
            const result = request.action === 'verify-email' ? await verifyEmail() : await manageAccess(request)
            if (request.action === 'access' && request.operation === 'leave') lastResult = { id: request.id, deleted: true }
            if (!ended) {
              send('access-result', { requestId: data.requestId, result })
              if (request.action === 'invite' || request.operation !== 'list') window.dispatchEvent(new Event('connect-profiles-changed'))
            }
          } catch (error) { if (!ended) send('access-result', { requestId: data.requestId, error: error instanceof Error ? error.message : 'Could not manage access. Please try again.' }) }
        }
        // Reading the sharing list never waits for, or holds up, a change.
        if (request.action === 'access' && request.operation === 'list') void run()
        else queue(run)
      } else if (data.type === 'closed') queue(async () => finish())
    }
    function writeProblem(write) {
      if (!['save', 'delete'].includes(write.action) || typeof write.dancer?.id !== 'string') return 'Could not save. Please try again.'
      if (context.dancer ? write.dancer.id !== context.dancer.id || write.dancer.revision !== context.dancer.revision : write.action === 'delete' || write.dancer.revision !== 0)
        return 'This dancer has changed. Close and reopen to edit.'
    }
    function accessProblem(request) {
      if (typeof manageAccess !== 'function' || !context.dancer || !['access', 'invite', 'verify-email'].includes(request?.action) || request.id !== context.dancer.id) return 'Could not manage access. Please try again.'
      if (request.action === 'verify-email' && typeof verifyEmail !== 'function') return 'Could not send the email. Please try again.'
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!context && !changing) finish() })
    signal?.addEventListener('abort', abort, { once: true })
    window.addEventListener('message', receive)
    document.addEventListener('keydown', cancelPending, true)
    document.body.append(dialog)
    frame.src = `${ORIGIN}/dancer-editor.html?parent=${encodeURIComponent(location.origin)}&session=${session}`
  })
}
