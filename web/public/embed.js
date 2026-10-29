/*
 * ScotDance.app for organisers' other tools (ADR 0015).
 *
 *   <script src="https://scotdance.app/embed.js"></script>
 *   const sent = await ScotDance.send({ source: 'Splits', name: 'entries.csv', text: csv })
 *   // → { sent: true, competitionId, competitionName, url } or { sent: false }
 *
 *   const me = await ScotDance.signIn({ audience: 'challenge' })
 *   // → { signedIn: true, pass, uid, email, name } or { signedIn: false }
 *
 * Opens ScotDance.app's own sheet over the page (connect.html, in a
 * full-window iframe). send: sign in if this browser isn't already, pick the
 * competition, and the list waits in its Import dancers. signIn: sign in, or
 * continue as whoever is, and get a short-lived pass that the tool's own
 * function checks (functions/src/toolPass.ts). Only ScotDance.app's own sites
 * may embed it. The messages are in src/connect/protocol.ts; keep the two in
 * step.
 */
;(() => {
  if (window.ScotDance) return

  const ORIGIN = new URL(document.currentScript ? document.currentScript.src : location.href).origin
  const CHANNEL = 'scotdance:connect'
  // How long ScotDance.app gets to open before saying it didn't.
  const TIMEOUT = 20000

  const STYLE = `
    :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; }
    .backdrop {
      position: fixed; inset: 0; background: rgb(0 0 0 / 0.4);
      opacity: 0; transition: opacity 320ms cubic-bezier(0.2, 0.9, 0.1, 1);
      display: grid; place-items: center;
    }
    .backdrop.in { opacity: 1; }
    .spinner {
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid rgb(255 255 255 / 0.3); border-top-color: #fff;
      animation: spin 0.8s linear infinite;
      opacity: 0; transition: opacity 200ms 400ms;
    }
    .backdrop.in .spinner { opacity: 1; }
    iframe {
      position: fixed; inset: 0; width: 100%; height: 100%;
      border: 0; margin: 0; padding: 0; background: transparent;
      visibility: hidden;
    }
    iframe.shown { visibility: visible; }
    .card {
      font: 16px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      background: #fff; color: #12161b; border-radius: 24px; padding: 24px;
      width: min(22rem, calc(100vw - 2rem)); box-sizing: border-box; text-align: center;
      box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
    }
    .card h2 { font-size: 1.125rem; margin: 0 0 4px; }
    .card p { margin: 0 0 20px; color: #5b6570; }
    .card button {
      font: inherit; font-weight: 600; border: 0; border-radius: 999px;
      height: 44px; padding: 0 20px; margin: 4px; cursor: pointer;
    }
    .card .primary { background: #0065bd; color: #fff; }
    .card .secondary { background: rgb(18 22 27 / 0.07); color: inherit; }
    @media (prefers-color-scheme: dark) {
      .card { background: #161b21; color: #eef2f6; }
      .card p { color: #b4beca; }
      .card .primary { background: #1a6fd0; }
      .card .secondary { background: rgb(238 242 246 / 0.08); }
    }
    @media (prefers-reduced-motion: reduce) {
      .backdrop, .spinner { transition: none; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `

  let active = null

  function send(item) {
    return open({ type: 'send', item: { kind: 'dancers', ...item } }, { sent: false })
  }

  function signIn(options) {
    return open({ type: 'signIn', audience: options && options.audience }, { signedIn: false })
  }

  function open(request, unfinished) {
    if (active) return active.promise
    let resolve
    const promise = new Promise((r) => (resolve = r))
    const opener = document.activeElement
    const root = document.documentElement
    const overflow = root.style.overflow
    let result = unfinished
    let timer

    const host = document.createElement('scotdance-connect')
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `<style>${STYLE}</style><div class="backdrop"></div>`
    const backdrop = shadow.querySelector('.backdrop')
    const iframe = document.createElement('iframe')
    iframe.title = 'ScotDance.app'
    shadow.appendChild(iframe)

    function load() {
      const spinner = Object.assign(document.createElement('div'), { className: 'spinner' })
      spinner.setAttribute('role', 'status')
      spinner.setAttribute('aria-label', 'Opening ScotDance.app')
      backdrop.replaceChildren(spinner)
      backdrop.classList.add('in')
      iframe.classList.remove('shown')
      iframe.src = `${ORIGIN}/connect.html`
      clearTimeout(timer)
      timer = setTimeout(failed, TIMEOUT)
    }

    // ScotDance.app didn't open (offline, or blocked): say so, in its colours.
    function failed() {
      const card = document.createElement('div')
      card.className = 'card'
      card.setAttribute('role', 'alertdialog')
      card.innerHTML =
        '<h2>ScotDance.app didn’t open</h2><p>Check your connection and try again.</p>' +
        '<button class="secondary" data-close>Close</button><button class="primary" data-retry>Try again</button>'
      card.querySelector('[data-close]').onclick = finish
      card.querySelector('[data-retry]').onclick = load
      backdrop.replaceChildren(card)
      card.querySelector('[data-retry]').focus()
    }

    function onMessage(e) {
      if (e.source !== iframe.contentWindow || e.origin !== ORIGIN) return
      const data = e.data
      if (!data || data.channel !== CHANNEL) return
      if (data.type === 'hello') {
        iframe.contentWindow.postMessage({ channel: CHANNEL, ...request }, ORIGIN)
      } else if (data.type === 'ready') {
        clearTimeout(timer)
        // The same colour scheme as the page inside, or the browser paints it opaque.
        iframe.style.colorScheme = data.scheme === 'dark' ? 'dark' : 'light'
        iframe.classList.add('shown')
        backdrop.classList.remove('in')
        iframe.focus()
      } else if (data.type === 'sent') {
        result = { sent: true, competitionId: data.competitionId, competitionName: data.competitionName, url: data.url }
      } else if (data.type === 'signedIn') {
        result = { signedIn: true, pass: data.pass, uid: data.uid, email: data.email, name: data.name }
      } else if (data.type === 'closed') {
        finish()
      }
    }

    // Escape before ScotDance.app has opened (after, it closes its own sheet).
    function onKeydown(e) {
      if (e.key === 'Escape' && !iframe.classList.contains('shown')) finish()
    }

    function finish() {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      document.removeEventListener('keydown', onKeydown, true)
      host.remove()
      root.style.overflow = overflow
      if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
      active = null
      resolve(result)
    }

    window.addEventListener('message', onMessage)
    document.addEventListener('keydown', onKeydown, true)
    root.style.overflow = 'hidden'
    document.body.appendChild(host)
    // Next frame, so the backdrop fades in rather than appearing.
    requestAnimationFrame(load)

    active = { promise }
    return promise
  }

  window.ScotDance = { send, signIn, origin: ORIGIN }
})()
