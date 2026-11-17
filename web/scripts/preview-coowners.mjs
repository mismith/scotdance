// Local-only two-parent preview using the real API and isolated emulators; never included in a build.
import { createRequire } from 'node:module'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
if (
  !/^demo-/.test(process.env.GCLOUD_PROJECT || '') ||
  !/^127\.0\.0\.1:/.test(process.env.FIRESTORE_EMULATOR_HOST || '') ||
  !/^127\.0\.0\.1:/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')
)
  throw new Error('Isolated local Auth/Firestore emulators and a demo project required.')
const backend =
  process.env.CONNECT_PREVIEW_BACKEND ||
  fileURLToPath(
    new URL('../../../scotdance-connect-coowners/functions/', import.meta.url),
  )
const require = createRequire(`${backend}/package.json`)
const { api } = require(`${backend}/dist/index.js`)
const { profileOwnership } = require(`${backend}/dist/ownership.js`)
const { invitationDelivery } = require(`${backend}/dist/invitationMail.js`)
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const { getApp } = require('firebase-admin/app')
const db = getFirestore(),
  auth = getAuth(getApp('identity')),
  profiles = profileOwnership(db)
const owners = {
  alex: {
    uid: 'preview-alex',
    displayName: 'Alex Grant',
    email: 'alex@example.test',
    emailVerified: true,
  },
  jamie: {
    uid: 'preview-jamie',
    displayName: 'Jamie Grant',
    email: 'jamie@example.test',
    emailVerified: true,
  },
}
const sessions = new Map(),
  inbox = []
const delivery = invitationDelivery(
  db,
  {
    find: async (id) => inbox.find((m) => m.id === id)?.id || null,
    send: async (to, inviter, token, id) => {
      inbox.push({ to, inviter, token, id })
      return id
    },
  },
  false,
)
for (const [key, user] of Object.entries(owners)) {
  try {
    await auth.createUser(user)
  } catch (e) {
    if (e.code !== 'auth/uid-already-exists') throw e
  }
  const cookie = randomBytes(32).toString('base64url')
  sessions.set(key, cookie)
  await db
    .doc(`sessions/${createHash('sha256').update(cookie).digest('hex')}`)
    .set({
      uid: user.uid,
      authTime: Date.now() / 1000,
      expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    })
}
if (!(await profiles.load(owners.alex.uid)).dancers.length) {
  for (const [i, name] of ['Isla', 'Ava'].entries())
    await profiles.save(
      owners.alex.uid,
      'save',
      {
        id: `fictional-dancer-${name.toLowerCase()}`,
        revision: 0,
        requestId: `seed-dancer-owner-${name.toLowerCase()}`,
        defaultsRevision: i ? 1 : 0,
        dancer: {
          firstName: name,
          lastName: 'Grant',
          birthday: '2015-04-12',
          studio: 'Campbell School of Highland Dance',
          category: 'Beginner',
          registrationNumber: 'C-AB-27-2007B',
          location: { town: 'Calgary', province: 'AB', country: 'Canada' },
          publicDancer: null,
        },
      },
      'preview',
    )
}
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
const banner = `<div style="position:relative;z-index:200;padding:10px 16px;background:#fff0bd;color:#372700;font:14px system-ui;display:flex;gap:16px;flex-wrap:wrap"><b>Local preview · fictional accounts</b><a href="/_preview?owner=alex">Alex</a><a href="/_preview?owner=jamie">Jamie</a><a href="/_preview/inbox">Preview inbox</a></div>`
const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.connect.config.ts', import.meta.url)),
  server: { port: 5330, strictPort: true, host: '127.0.0.1' },
  plugins: [
    {
      name: 'local-coowners',
      transformIndexHtml: (html) => html.replace('<body>', `<body>${banner}`),
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url, 'http://127.0.0.1:5330')
          const key =
            req.headers.cookie?.match(/(?:^|;\s*)preview-owner=(alex|jamie)/)?.[1] ||
            'alex'
          if (url.pathname === '/_preview') {
            const chosen = url.searchParams.get('owner') === 'jamie' ? 'jamie' : 'alex'
            res.setHeader(
              'Set-Cookie',
              `preview-owner=${chosen}; Path=/; SameSite=Strict; HttpOnly`,
            )
            res.writeHead(302, { Location: '/dancers' })
            res.end()
            return
          }
          if (url.pathname === '/_preview/inbox') {
            res.setHeader('Content-Type', 'text/html')
            res.setHeader('Cache-Control', 'no-store')
            res.end(
              `${banner}<main style="max-width:600px;margin:40px auto;padding:16px;font:18px system-ui"><h1>Preview inbox</h1><p>No real emails are sent here. These messages use the invitation delivery code.</p>${inbox.map((m) => `<article style="margin:24px 0"><b>To: ${escape(m.to)}</b><p>${escape(m.inviter)} invited you to share dancers.</p><a href="/invite/${m.token}">Open invitation</a></article>`).join('') || '<p>No invitations yet.</p>'}</main>`,
            )
            return
          }
          if (url.pathname === '/_preview/embed') {
            res.setHeader('Content-Type', 'text/html')
            res.end(`${banner}<main style="padding:32px;font:18px system-ui"><button id="edit">Edit shared dancer</button><p id="result"></p></main><script type="module">
              import { openDancerEditor } from '/dancer-editor.js';
              async function call(action, body={}) { const r=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const value=await r.json(); if(!r.ok) throw Error(value.error); return value; }
              document.getElementById('edit').onclick=async event=>{
                try {
                  await openDancerEditor({ opener:event.currentTarget,
                    load:async()=>{ const state=await call('load');return { dancer:state.dancers.find(d=>d.id==='fictional-dancer-isla'),defaults:state.defaults,defaultsRevision:state.defaultsRevision,otherDancers:state.dancers.length>1 }; },
                    manageAccess:({action,...body})=>call(action,body),
                    save:async write=>{ const {id,revision,shared,ownerCount,...dancer}=write.dancer; const result=await call(write.action,{id,revision,dancer,requestId:write.requestId,defaults:write.defaults,defaultsRevision:write.defaultsRevision});return write.action==='delete'?{id,deleted:true}:{id,dancer:{...write.dancer,revision:result.revision}}; }
                  });
                }catch(e){document.getElementById('result').textContent=e.message;}
              };
            </script>`)
            return
          }
          if (!url.pathname.startsWith('/api/')) return next()
          try {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
            let status = 200,
              result
            const headers = {
              origin: 'https://connect.scotdance.app',
              cookie: `__session=${sessions.get(key)}`,
            }
            await api(
              {
                method: req.method,
                path: url.pathname,
                body,
                headers,
                get: (k) => headers[k.toLowerCase()],
                is: (type) => type === 'application/json',
              },
              {
                set() {
                  return this
                },
                setHeader() {
                  return this
                },
                status(code) {
                  status = code
                  return this
                },
                json(value) {
                  result = value
                  return this
                },
              },
            )
            if (url.pathname === '/api/invite' && result?.token)
              await delivery.deliver(
                createHash('sha256').update(result.token).digest('hex'),
              )
            res.writeHead(status, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            })
            res.end(JSON.stringify(result))
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      },
    },
  ],
})
await server.listen()
console.log(
  'Co-owner preview: http://127.0.0.1:5330/dancers — Alex / Jamie / local inbox',
)
