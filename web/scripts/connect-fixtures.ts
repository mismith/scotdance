import type { Plugin } from 'vite'

/** Loopback development backend for the real Connect app. Never enabled in builds. */
export function connectFixtures(): Plugin {
  const uid = 'local-connect-account'
  let name = 'Alex Parent'
  const defaults = { studio: 'Glenmore School of Dance', location: { town: 'Calgary', province: 'AB', country: 'Canada' } }
  const tools: Record<string, { linkedAt: number; signedInAt: number }> = Object.fromEntries(
    ['challenge', 'binder', 'entries'].map((tool, i) => [tool, { linkedAt: Date.now() - 86400000 * 30, signedInAt: Date.now() - i * 86400000 }]),
  )
  return {
    name: 'connect-local-fixtures',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__fixture/')) return next()
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        try {
          let raw = ''
          for await (const chunk of req) { raw += chunk; if (raw.length > 1600000) throw Error('Too large') }
          const data = raw ? JSON.parse(raw) : {}
          const identity = { localId: uid, displayName: name, email: 'parent@example.test', createdAt: '1609459200000', lastLoginAt: String(Date.now()), providerUserInfo: [{ providerId: 'password' }] }
          let result: unknown
          if (url.pathname === '/api/load') result = { account: { uid, name, email: identity.email, emailVerified: true }, dancers: [], defaults, defaultsRevision: 1 }
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
