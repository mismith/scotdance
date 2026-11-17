const endpoint = 'https://identitytoolkit.googleapis.com/v1/accounts:'
const key = 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM'
export async function completeVerification(code: string, request: typeof fetch = fetch) {
  if (!code || code.length > 2048) throw new Error('invalid-link')
  async function call(action: string) {
    const response = await request(`${endpoint}${action}?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: code }),
    })
    const result = await response.json()
    if (!response.ok) {
      const error = result.error?.message
      throw new Error(error === 'INVALID_OOB_CODE' || error === 'EXPIRED_OOB_CODE' ? 'invalid-link' : 'request-failed')
    }
    return result
  }
  // Only consume email verification codes, never password-reset or email-change links.
  const info = await call('resetPassword')
  if (info.requestType !== 'VERIFY_EMAIL') throw new Error('invalid-link')
  await call('update')
}
