import type { Plugin } from 'vite'

/** Loopback development backend for the real Connect app. Never enabled in builds. */
export function connectFixtures(): Plugin {
  const uid = 'local-connect-account'
  let name = 'Alex Parent'
  let verified = false
  let verificationCode = ''
  const invitations: { id: string; email: string; delivery: string }[] = []
  const dancers = [{ id: 'isla', revision: 0, firstName: 'Isla', lastName: 'Fraser', birthday: '2018-03-12', category: 'Beginner', studio: 'Glenmore School of Dance', registrationNumber: '', ownerCount: 1 }]
  const defaults = { studio: 'Glenmore School of Dance', location: { town: 'Calgary', province: 'AB', country: 'Canada' } }
  const tools: Record<string, { linkedAt: number; signedInAt: number }> = Object.fromEntries(
    ['challenge', 'binder', 'entries'].map((tool, i) => [tool, { linkedAt: Date.now() - 86400000 * 30, signedInAt: Date.now() - i * 86400000 }]),
  )
  return {
    name: 'connect-local-fixtures',
    transformIndexHtml(html) {
      return html.replace('<body>', '<body><div style="padding:8px 16px;background:#ffefc7;color:#7a4600;font:13px system-ui;text-align:center">Local preview · fictional account · <a href="/__fixture/inbox" target="_blank">Test inbox / reset</a></div>')
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__fixture/')) return next()
        if (url.pathname === '/__fixture/inbox') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(`<main style="font:17px system-ui;max-width:560px;margin:50px auto;padding:20px"><h1>Local test inbox</h1><p>Fictional emails only. Nothing is sent externally.</p>${verificationCode ? `<p>To: parent@example.test</p><h2>Verify your email</h2><p><a href="/__fixture/verify?code=${verificationCode}">Verify email address</a></p>` : '<p>No verification email yet. Click Verify in Account or Sharing, then refresh this inbox.</p>'}<p><a href="/account">Account</a> · <a href="/dancers">Dancers</a></p><form method="post" action="/__fixture/reset"><button>Reset verification to try again</button></form></main>`)
          return
        }
        if (url.pathname === '/__fixture/verify') {
          const valid = !!verificationCode && url.searchParams.get('code') === verificationCode
          if (valid) { verified = true; verificationCode = '' }
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(`<main style="font:17px system-ui;max-width:560px;margin:50px auto;padding:20px"><h1>${valid ? 'Email verified' : 'Link expired or already used'}</h1><p>${valid ? 'Return to your original Account or Sharing tab.' : 'Request a fresh email from Account or Sharing.'}</p><a href="/account">Account</a> · <a href="/dancers">Dancers</a></main>`)
          return
        }
        if (url.pathname === '/__fixture/reset' && req.method === 'POST') {
          verified = false; verificationCode = ''; invitations.splice(0)
          res.writeHead(303, { Location: '/account' }); res.end(); return
        }
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        try {
          let raw = ''
          for await (const chunk of req) { raw += chunk; if (raw.length > 1600000) throw Error('Too large') }
          const data = raw ? JSON.parse(raw) : {}
          const identity = { localId: uid, displayName: name, email: 'parent@example.test', emailVerified: verified, createdAt: '1609459200000', lastLoginAt: String(Date.now()), providerUserInfo: [{ providerId: 'password' }] }
          let result: unknown
          if (url.pathname === '/api/load') result = { account: { uid, name, email: identity.email, emailVerified: verified }, dancers, defaults, defaultsRevision: 1 }
          else if (url.pathname === '/api/access' && data.id === 'isla' && data.operation === 'list') result = { id: 'isla', name: 'Isla Fraser', shared: false, emailVerified: verified, accessRevision: 0, owners: [{ uid, name, you: true }], invitations, dancers: [{ id: 'isla', name: 'Isla Fraser' }] }
          else if (url.pathname === '/api/invite') { if (!verified) throw Error('Verify your email first'); invitations.push({ id: crypto.randomUUID(), email: String(data.email), delivery: 'sent' }); result = { ok: true } }
          else if (url.pathname === '/__fixture/auth/accounts:sendOobCode' && data.requestType === 'VERIFY_EMAIL' && data.idToken === 'local-fixture-token') { verificationCode = crypto.randomUUID(); result = { email: identity.email } }
          else if (url.pathname === '/api/logout') result = { ok: true }
          else if (url.pathname === '/__fixture/auth/accounts:lookup') result = { users: [identity] }
          else if (url.pathname === '/__fixture/auth/accounts:update') { name = data.displayName ?? name; result = { ...identity, displayName: name, idToken: 'local-fixture-token', expiresIn: '3600' } }
          else if (url.pathname === `/__fixture/database/fixture/users/${uid}.json`) { if (data.displayName) name = data.displayName; result = { displayName: name } }
          else if (url.pathname === `/__fixture/database/fixture/users:tools/${uid}.json`) result = tools
          else if (url.pathname === '/__fixture/functions/unlinkTool' && Object.hasOwn(tools, data.data?.tool)) { delete tools[data.data.tool]; result = { result: { unlinked: [data.data.tool] } } }
          else { res.statusCode = 400; result = { error: { message: 'This action is not available in the local fixture.' } } }
          res.end(JSON.stringify(result))
        } catch { res.statusCode = 400; res.end(JSON.stringify({ error: { message: 'Invalid local fixture request.' } })) }
      })
    },
  }
}
