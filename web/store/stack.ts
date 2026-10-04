// The store stack: the emulators, search and the app on their own ports
// (everything +40), beside any dev stack. The database starts empty every
// run (no import, no export), so the shots only ever show the demo data and
// never touch anyone's local data.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type ViteDevServer } from 'vite'

export const OFFSET = 40
export const APP_URL = `http://localhost:${5273 + OFFSET}`
export const TYPESENSE_PORT = 8108 + OFFSET

const ROOT = new URL('../../', import.meta.url).pathname
const WEB = `${ROOT}web/`
// The CLI wants its rules and functions inside the config's folder, so this
// one sits beside firebase.json (gitignored).
const CONFIG = `${ROOT}firebase.store.json`
const HUB = `http://127.0.0.1:${4400 + OFFSET}`
const TYPESENSE = 'scotdance-store-typesense'

const port = (p: number) => p + OFFSET

function config() {
  const base = JSON.parse(readFileSync(`${ROOT}firebase.json`, 'utf8'))
  const host = '127.0.0.1'
  return {
    database: base.database.map((d: { instance: string; rules: string }) => ({
      ...d,
      rules: d.rules,
    })),
    functions: { source: 'functions' },
    emulators: {
      auth: { host, port: port(9099) },
      database: { host, port: port(9009) },
      functions: { host, port: port(5001) },
      hub: { host, port: port(4400) },
      logging: { host, port: port(4500) },
      eventarc: { host, port: port(9299) },
      tasks: { host, port: port(9499) },
      ui: { enabled: false },
    },
  }
}

const up = (url: string) =>
  fetch(url).then(
    (r) => r.ok,
    () => false,
  )

/** Whether a store stack is already running (`npm run store:stack`). */
export const running = () => up(`${HUB}/emulators`)

export interface Stack {
  stop: () => Promise<void>
}

export async function startStack(): Promise<Stack> {
  // The functions emulator reads its secrets from here. Without
  // RUNTIME_CONFIG it would fetch the real one (and send real email).
  const secrets = `${ROOT}functions/.secret.local`
  if (!existsSync(secrets) || !/^RUNTIME_CONFIG=/m.test(readFileSync(secrets, 'utf8'))) {
    throw new Error(
      'functions/.secret.local needs RUNTIME_CONFIG={} (see .env.example): stopping before the emulator fetches real config.',
    )
  }
  if (!existsSync(`${ROOT}functions/node_modules`))
    throw new Error('Run `npm ci` in functions/ first.')
  console.log('Building functions…')
  execFileSync('npm', ['--prefix', `${ROOT}functions`, 'run', 'build'], {
    stdio: 'ignore',
  })

  writeFileSync(CONFIG, JSON.stringify(config(), null, 2))

  // Search, in Docker (the repo's typesense-server is x86). Optional: the
  // functions index into it on a best-effort basis.
  let search = false
  try {
    execFileSync('docker', ['rm', '-f', TYPESENSE], { stdio: 'ignore' })
    execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--rm',
        '--name',
        TYPESENSE,
        '-p',
        `${TYPESENSE_PORT}:8108`,
        'typesense/typesense:0.23.1',
        '--data-dir',
        '/tmp',
        '--api-key=xyz',
        '--enable-cors',
      ],
      { stdio: 'ignore' },
    )
    search = true
  } catch {
    console.warn('No Docker: running without search.')
  }

  console.log('Starting the emulators…')
  const emulators: ChildProcess = spawn(
    'firebase',
    [
      '--config',
      CONFIG,
      '--project',
      'firebase-scotdance',
      'emulators:start',
      '--only',
      'auth,database,functions',
      // One functions worker: the seed's trigger fan-out swamps a pool.
      '--inspect-functions',
      String(port(9229)),
    ],
    {
      cwd: ROOT,
      env: { ...process.env, TYPESENSE_PORT: String(TYPESENSE_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  )
  let log = ''
  emulators.stdout!.on('data', (d) => (log += d))
  emulators.stderr!.on('data', (d) => (log += d))
  let gone = false
  const exited = new Promise<void>((r) =>
    emulators.on('exit', () => ((gone = true), r())),
  )
  for (let i = 0; i < 240 && !gone && !/All emulators ready/.test(log); i++)
    await new Promise((r) => setTimeout(r, 500))
  if (!/All emulators ready/.test(log)) {
    console.error(log.slice(-4000))
    if (!gone) process.kill(-emulators.pid!, 'SIGINT')
    if (search) execFileSync('docker', ['rm', '-f', TYPESENSE], { stdio: 'ignore' })
    throw new Error("The emulators didn't start")
  }

  console.log('Starting the app…')
  process.env.VITE_EMULATOR_PORT_OFFSET = String(OFFSET)
  const vite: ViteDevServer = await createServer({
    root: WEB,
    mode: 'emulator',
    logLevel: 'warn',
    server: { port: port(5273), strictPort: true },
  })
  await vite.listen()
  console.log(`Store stack up: ${APP_URL}${search ? '' : ' (no search)'}`)

  return {
    async stop() {
      await vite.close()
      // SIGINT lets the emulators shut down cleanly (and kill the functions worker).
      try {
        process.kill(-emulators.pid!, 'SIGINT')
      } catch {
        /* already gone */
      }
      await Promise.race([exited, new Promise((r) => setTimeout(r, 15_000))])
      if (search) execFileSync('docker', ['rm', '-f', TYPESENSE], { stdio: 'ignore' })
    },
  }
}
