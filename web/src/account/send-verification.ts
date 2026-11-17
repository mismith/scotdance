const endpoint = 'https://us-central1-firebase-scotdance.cloudfunctions.net/sendVerificationEmail'
export async function sendVerificationEmail(token: string, request: typeof fetch = fetch, url = endpoint) {
  const response = await request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: {} }),
  })
  const result = await response.json()
  if (!response.ok || result.error) throw Object.assign(new Error('Could not send the verification email. Please try again.'), {
    code: result.error?.status === 'RESOURCE_EXHAUSTED' ? 'auth/too-many-requests' : 'auth/request-failed',
  })
}
