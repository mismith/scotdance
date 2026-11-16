import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Dancer {
  id: string
  revision: number
  firstName: string
  lastName: string
  birthday: string
  category: string
  studio: string
  registrationNumber: string
  location?: { town: string; province: string; country: string }
}
interface Account { uid: string; name: string; email: string; emailVerified: boolean }

export const useConnectAccount = defineStore('connect-account', () => {
  const account = ref<Account | null>(null)
  const dancers = ref<Dancer[]>([])
  const busy = ref(false)
  const ready = ref(false)
  const error = ref('')
  let identityPass = ''
  let identityUntil = 0

  function clear() {
    account.value = null
    dancers.value = []
    identityPass = ''
    identityUntil = 0
  }
  async function api(action: string, data = {}) {
    const response = await fetch(`/api/${action}`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    const body = await response.json().catch(() => { throw new Error('Could not reach Connect. Please try again.') })
    if (!response.ok) {
      if (response.status === 401) clear()
      throw Object.assign(new Error(body.error || 'Please try again.'), { status: response.status })
    }
    return body
  }
  async function load() {
    const data = await api('load')
    account.value = data.account
    dancers.value = data.dancers
  }
  async function run(fn: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try { await fn(); return true }
    catch (e) { error.value = e instanceof Error ? e.message : 'Please try again.'; return false }
    finally { busy.value = false }
  }
  async function handoff() {
    const w = window as Window & { ScotDance?: { signIn(options: { audience: string }): Promise<{ signedIn: boolean; pass: string; uid: string }> } }
    if (!w.ScotDance) await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://next.scotdance.app/embed.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not open ScotDance sign-in.'))
      document.head.append(script)
    })
    if (!w.ScotDance) throw new Error('Could not open sign-in.')
    return w.ScotDance.signIn({ audience: 'connect' })
  }
  async function identityToken() {
    if (identityPass && Date.now() < identityUntil) return identityPass
    const uid = account.value?.uid
    const result = await handoff()
    if (!result.signedIn) throw new Error('Sign in to edit your account.')
    if (!uid || account.value?.uid !== uid || result.uid !== uid) throw new Error('Sign in with the same ScotDance account to edit these details.')
    identityPass = result.pass
    identityUntil = Date.now() + 50 * 60 * 1000
    return identityPass
  }
  async function login() {
    await run(async () => {
      const result = await handoff()
      if (!result.signedIn) return
      await api('login', { token: result.pass })
      await load()
      identityPass = result.pass
      identityUntil = Date.now() + 50 * 60 * 1000
    })
  }
  async function initialize(openAccount: boolean) {
    try { await load() }
    catch (e) {
      if (e && typeof e === 'object' && 'status' in e && e.status === 401) {
        if (openAccount) await login()
      } else error.value = e instanceof Error ? e.message : 'Could not open Connect.'
    } finally { ready.value = true }
  }
  const logout = () => run(async () => { await api('logout'); clear() })
  async function refresh(token: string) {
    await api('login', { token })
    identityPass = token
    identityUntil = Date.now() + 50 * 60 * 1000
    await load()
  }
  async function save(dancer: Dancer, remove = false) {
    return run(async () => {
      const { id, revision, firstName, lastName, birthday, category, studio, registrationNumber, location } = dancer
      const details = { firstName, lastName, birthday, category, studio, registrationNumber, ...(location ? { location } : {}) }
      await api(remove ? 'delete' : 'save', { id, revision, requestId: crypto.randomUUID(), dancer: details })
      await load()
    })
  }
  return { account, dancers, busy, ready, error, clear, initialize, login, logout, refresh, identityToken, load, save, run }
})
