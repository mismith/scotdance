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

  function clear() {
    account.value = null
    dancers.value = []
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
  async function login() {
    await run(async () => {
      const w = window as Window & { ScotDance?: { signIn(options: { audience: string }): Promise<{ signedIn: boolean; pass: string }> } }
      if (!w.ScotDance) await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://next.scotdance.app/embed.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Could not open ScotDance sign-in.'))
        document.head.append(script)
      })
      if (!w.ScotDance) throw new Error('Could not open sign-in.')
      const result = await w.ScotDance.signIn({ audience: 'connect' })
      if (!result.signedIn) return
      await api('login', { token: result.pass })
      await load()
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
  const refresh = (token: string) => run(async () => { await api('login', { token }); await load() })
  async function save(dancer: Dancer, remove = false) {
    return run(async () => {
      const { id, revision, firstName, lastName, birthday, category, studio, registrationNumber, location } = dancer
      const details = { firstName, lastName, birthday, category, studio, registrationNumber, ...(location ? { location } : {}) }
      await api(remove ? 'delete' : 'save', { id, revision, requestId: crypto.randomUUID(), dancer: details })
      await load()
    })
  }
  return { account, dancers, busy, ready, error, clear, initialize, login, logout, refresh, save, run }
})
