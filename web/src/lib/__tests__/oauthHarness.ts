import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { forgetClients } from '../../../../functions/src/oauth/cimd'
import { knownHosts } from '../../../../functions/src/oauth/known'
import { oauthRouter } from '../../../../functions/src/oauth/index'
import { memoryStore } from '../../../../functions/src/oauth/memory'
import { runtime } from '../../../../functions/src/oauth/runtime'

// Scaffolding for the functions' OAuth tests: a fake database and clock, a client-document server, and the OAuth
// router on a real port. (Binder's, with the Realtime Database in place of Firestore.)

export const ORIGIN = 'https://next.example.com'
export const RESOURCE = `${ORIGIN}/mcp`

export interface Reply {
  status?: number
  headers?: Record<string, string>
  body?: string
  /** Never answer */
  hang?: boolean
}

export interface Harness {
  store: ReturnType<typeof memoryStore>
  /** The OAuth server's base URL */
  base: string
  /** The client-document server's base URL */
  clients: string
  serve(path: string, reply: Reply): void
  /** The client_id for a path on the client server, with a good document served there */
  client(path?: string, extra?: object): string
  clock: { now: number }
  close(): Promise<void>
}

const listen = (server: Server) =>
  new Promise<string>((done) => server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)))

/** The environment the functions run in under the emulator, with the origin the tests expect */
export function emulatorEnv() {
  process.env.MCP_ORIGIN = ORIGIN
  process.env.FUNCTIONS_EMULATOR = 'true'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9'
}

export async function harness(options: { preparse?: 'express' | 'manual' } = {}): Promise<Harness> {
  emulatorEnv()
  // The test clients live on loopback; they stand in for an assistant that is known (known.ts)
  knownHosts.add('127.0.0.1')
  const store = memoryStore()
  const clock = { now: Date.UTC(2026, 10, 10, 12) }
  runtime.store = store
  runtime.now = () => clock.now
  runtime.fetchTimeoutMs = 300
  forgetClients()

  const replies = new Map<string, Reply>()
  const clientServer = createServer((req, res) => {
    const reply = replies.get(req.url ?? '')
    if (!reply) return void res.writeHead(404).end()
    if (reply.hang) return
    res.writeHead(reply.status ?? 200, { 'Content-Type': 'application/json', ...reply.headers }).end(reply.body ?? '')
  })
  const clients = await listen(clientServer)

  const app = express()
  if (options.preparse === 'express') app.use(express.urlencoded({ extended: false }))
  if (options.preparse === 'manual')
    // Parsed by someone else, leaving no mark that it was (the worst case for the handlers)
    app.use(async (req, _res, next) => {
      if (req.method !== 'POST') return next()
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      req.body = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()))
      next()
    })
  app.use(oauthRouter())
  const server = createServer(app)
  const base = await listen(server)

  return {
    store,
    base,
    clients,
    clock,
    serve(path, reply) {
      replies.set(path, reply)
    },
    client(path = '/client', extra = {}) {
      const id = `${clients}${path}`
      replies.set(path, {
        body: JSON.stringify({
          client_id: id,
          client_name: 'Claude',
          client_uri: 'https://claude.example/',
          redirect_uris: ['https://claude.example/callback', 'http://127.0.0.1:33418/callback'],
          ...extra,
        }),
      })
      return id
    },
    close: () =>
      Promise.all([server, clientServer].map((s) => new Promise<void>((done) => s.close(() => done())))).then(() => undefined),
  }
}

export const pkce = () => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export const form = (fields: Record<string, string>) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
})
