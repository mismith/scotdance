import { reactive } from 'vue'
import { sendVerificationEmail } from './send-verification'
import { linkedTools, type Audience } from './tool-links'
import type { AccountSettings } from './settings'

// Firebase's user-scoped REST API accepts the existing sign-in handoff token.
// No custom tokens, admin credentials or password handling on the Connect server.
// https://firebase.google.com/docs/reference/rest/auth
const API_KEY = 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM'
interface Identity {
  localId: string
  email?: string
  emailVerified?: boolean
  displayName?: string
  passwordUpdatedAt?: number
  createdAt?: string
  lastLoginAt?: string
  photoUrl?: string
  providerUserInfo?: { providerId: string }[]
}
interface Session {
  idToken: string
  localId: string
  expiresIn?: string
}
export interface SettingsOptions {
  uid: string
  acquireToken(): Promise<string>
  refreshSession(token: string): Promise<void>
  fetch?: typeof fetch
  authURL?: string
  databaseURL?: string
  functionsURL?: string
  namespace?: string
  now?: () => number
}
const codes: Record<string, string> = {
  INVALID_LOGIN_CREDENTIALS: 'invalid-credential',
  INVALID_PASSWORD: 'wrong-password',
  EMAIL_EXISTS: 'email-already-in-use',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'requires-recent-login',
  INVALID_ID_TOKEN: 'requires-recent-login',
  TOKEN_EXPIRED: 'requires-recent-login',
  USER_NOT_FOUND: 'user-not-found',
  USER_DISABLED: 'user-disabled',
  WEAK_PASSWORD: 'weak-password',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'too-many-requests',
}
const fail = (code: string) =>
  Object.assign(new Error('Could not update your account.'), { code: `auth/${code}` })

export function createFirebaseSettings(options: SettingsOptions) {
  const request = options.fetch ?? fetch
  const now = options.now ?? Date.now
  const authURL = options.authURL ?? 'https://identitytoolkit.googleapis.com/v1'
  const dbURL = options.databaseURL ?? 'https://scotdance.firebaseio.com'
  const functionsURL =
    options.functionsURL ?? 'https://us-central1-firebase-scotdance.cloudfunctions.net'
  const namespace = options.namespace ?? 'production'
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(options.uid)) throw fail('user-mismatch')
  let token = ''
  let tokenUntil = 0
  let active = true
  const profile = reactive({
    user: null as AccountSettings['user'],
    displayName: null as string | null,
    photoURL: null as string | null,
    hasPassword: false,
  })
  function assertActive() {
    if (!active) throw fail('user-mismatch')
  }
  function assertOwner(user: Identity) {
    assertActive()
    if (user?.localId !== options.uid) throw fail('user-mismatch')
  }
  async function auth<T>(action: string, body: object): Promise<T> {
    assertActive()
    const res = await request(`${authURL}/accounts:${action}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await res.json()
    if (!res.ok)
      throw fail(
        codes[String(result.error?.message).split(' : ')[0]!] ?? 'request-failed',
      )
    assertActive()
    return result as T
  }
  function remember(session: Session) {
    assertOwner(session)
    token = session.idToken
    tokenUntil = now() + Math.min(50 * 60, Number(session.expiresIn) || 3600) * 1000
  }
  async function identityToken() {
    assertActive()
    if (token && now() < tokenUntil) return token
    const candidate = await options.acquireToken()
    const result = await auth<{ users: Identity[] }>('lookup', { idToken: candidate })
    const user = result.users?.[0]
    if (!user) throw fail('user-not-found')
    assertOwner(user)
    token = candidate
    tokenUntil = now() + 50 * 60 * 1000
    apply(user)
    return token
  }
  function apply(user: Identity, preserveVerification = false) {
    assertOwner(user)
    const metadata = { ...profile.user?.metadata }
    for (const [source, target] of [['createdAt', 'creationTime'], ['lastLoginAt', 'lastSignInTime'], ['passwordUpdatedAt', 'passwordUpdatedTime']] as const) {
      if (user[source] !== undefined) {
        const value = Number(user[source])
        const date = new Date(value)
        metadata[target] = value > 0 && Number.isFinite(date.getTime()) ? date.toISOString() : undefined
      }
    }
    profile.user = { email: user.email ?? null, emailVerified: user.emailVerified ?? (preserveVerification && user.email === profile.user?.email ? profile.user?.emailVerified : false) ?? false, metadata }
    profile.displayName = user.displayName ?? null
    profile.photoURL = user.photoUrl ?? null
    profile.hasPassword =
      user.providerUserInfo?.some((p) => p.providerId === 'password') ?? false
  }
  async function database(path: string, method = 'GET', values?: object) {
    const idToken = await identityToken()
    const url = new URL(`${dbURL}/${namespace}${path ? `/${path}` : ''}.json`)
    url.searchParams.set('auth', idToken)
    const res = await request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(values ? { body: JSON.stringify(values) } : {}),
    })
    if (!res.ok) throw new Error('Could not save your account details. Please try again.')
    return res.json()
  }
  async function load() {
    await identityToken()
    const record = await database(`users/${options.uid}`)
    assertActive()
    if (typeof record?.displayName === 'string') profile.displayName = record.displayName
  }
  async function loadTools() {
    const result = await database(`users:tools/${options.uid}`)
    assertActive()
    return linkedTools(result).filter(({ tool }) => tool !== 'connect')
  }
  async function checkEmailVerification() {
    const result = await auth<{ users: Identity[] }>('lookup', { idToken: await identityToken() })
    const user = result.users?.[0]
    if (!user) throw fail('user-not-found')
    apply(user)
    return user.emailVerified === true
  }
  async function signOutTool(tool: Audience) {
    if (tool === 'connect') throw new Error('Use Sign out to leave Connect.')
    const idToken = await identityToken()
    const response = await request(`${functionsURL}/unlinkTool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: { tool } }),
    })
    const result = await response.json()
    assertActive()
    if (!response.ok || result.error) throw new Error('Could not sign out of this tool. Please try again.')
  }
  async function reauthenticate(password?: string) {
    await identityToken()
    if (profile.hasPassword && profile.user?.email) {
      const session = await auth<Session>('signInWithPassword', {
        email: profile.user.email,
        password: password ?? '',
        returnSecureToken: true,
      })
      remember(session) // A stale email can never switch the account being edited.
    } else {
      // Advisory only; Firebase independently enforces recent authentication.
      const claims = JSON.parse(
        atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
      ) as { auth_time?: number }
      if (!claims.auth_time || now() / 1000 - claims.auth_time > 240)
        throw fail('requires-recent-login')
    }
  }
  async function update(values: object, renewSession: boolean) {
    const result = await auth<Identity & Session>('update', {
      idToken: await identityToken(),
      ...values,
      returnSecureToken: true,
    })
    remember(result)
    apply(result, true)
    if (renewSession) await options.refreshSession(token)
  }
  const settings: AccountSettings = {
    get user() {
      return profile.user
    },
    get displayName() {
      return profile.displayName
    },
    get photoURL() {
      return profile.photoURL
    },
    get hasPassword() {
      return profile.hasPassword
    },
    async updateDisplayName(name) {
      await update(
        name ? { displayName: name } : { deleteAttribute: ['DISPLAY_NAME'] },
        false,
      )
      await database(`users/${options.uid}`, 'PATCH', { displayName: name || null })
    },
    async updateUserEmail(email, password) {
      await reauthenticate(password)
      await update({ email }, true)
      await database(`users/${options.uid}`, 'PATCH', { email })
    },
    async updateUserPassword(password, currentPassword) {
      await reauthenticate(currentPassword)
      await update({ password }, true)
      // Update responses omit this timestamp. Read Firebase's value rather than
      // inventing a local change time; an optional refresh must not fail the save.
      if (profile.user?.metadata) profile.user.metadata.passwordUpdatedTime = undefined
      try {
        const result = await auth<{ users: Identity[] }>('lookup', { idToken: token })
        if (result.users?.[0]) apply(result.users[0])
      } catch { /* The password was saved; leave its date hidden until next load. */ }
    },
    async resetPassword(email) {
      if (email !== profile.user?.email) throw fail('user-mismatch')
      await auth('sendOobCode', { requestType: 'PASSWORD_RESET', email })
    },
    checkEmailVerification,
    async sendVerificationEmail() {
      if (await checkEmailVerification()) return
      if (!profile.user?.email) throw fail('user-not-found')
      await sendVerificationEmail(await identityToken(), request, `${functionsURL}/sendVerificationEmail`)
    },
    async deleteAccount(password) {
      await reauthenticate(password)
      const idToken = await identityToken()
      // Match the existing account deletion flow; the Auth hook erases Connect profiles.
      await Promise.all(
        ['unlinkTool', 'endConnection'].map((action) =>
          request(`${functionsURL}/${action}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ data: {} }),
          }).catch(() => {}),
        ),
      )
      await database(
        '',
        'PATCH',
        Object.fromEntries(
          [
            'users',
            'users:favorites',
            'users:alertsOff',
            'users:dancerColors',
            'users:tokens',
            'users:inbox',
            'users:changes',
            'users:tools',
            'users:permissions',
          ].map((path) => [`${path}/${options.uid}`, null]),
        ),
      )
      await auth('delete', { idToken })
      dispose()
    },
  }
  function dispose() {
    active = false
    token = ''
    tokenUntil = 0
    profile.user = null
  }
  return { settings, load, loadTools, signOutTool, dispose }
}
