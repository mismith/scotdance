import { expect, it, vi } from 'vitest'
import { completeVerification } from '../complete-verification'
it('checks the code type before consuming it', async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ requestType: 'VERIFY_EMAIL' }))).mockResolvedValueOnce(new Response('{}'))
  await completeVerification('example', request)
  expect(request.mock.calls.map(c => c[0].split('?')[0].split(':').at(-1))).toEqual(['resetPassword', 'update'])
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ oobCode: 'example' })
})
it('never consumes a password reset or email change code', async () => {
  for (const requestType of ['PASSWORD_RESET', 'VERIFY_AND_CHANGE_EMAIL']) {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ requestType })))
    await expect(completeVerification('example', request)).rejects.toThrow('invalid-link')
    expect(request).toHaveBeenCalledTimes(1)
  }
})
it('distinguishes used links from connection or configuration failures', async () => {
  for (const [message, expected] of [['INVALID_OOB_CODE','invalid-link'],['EXPIRED_OOB_CODE','invalid-link'],['API_KEY_HTTP_REFERRER_BLOCKED','request-failed']]) {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message}}),{status:400}))
    await expect(completeVerification('example',request)).rejects.toThrow(expected)
  }
})
it('does not claim success when applying the code fails', async () => {
  const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({requestType:'VERIFY_EMAIL'}))).mockResolvedValueOnce(new Response(JSON.stringify({error:{message:'INVALID_OOB_CODE'}}),{status:400}))
  await expect(completeVerification('example',request)).rejects.toThrow('invalid-link')
})
