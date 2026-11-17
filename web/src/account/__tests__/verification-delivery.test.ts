import { beforeEach, expect, it, vi } from 'vitest'
import type { Auth } from 'firebase-admin/auth'
import type { Reference } from 'firebase-admin/database'
const send=vi.hoisted(()=>vi.fn())
vi.mock('../../../../functions/src/utility/email',()=>({getPostmark:()=>({sendEmailWithTemplate:send})}))
import {getOnSendVerificationEmail,verificationLink} from '../../../../functions/src/emailVerification'
beforeEach(()=>vi.resetAllMocks())
function setup(verified=false, committed=true) {
  const auth={getUser:vi.fn(async()=>({uid:'owner',email:'owner@example.test',emailVerified:verified})),generateEmailVerificationLink:vi.fn(async()=> 'https://scotdance.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=secret&apiKey=public')}
  const transaction=vi.fn(async()=>({committed}))
  const handler=getOnSendVerificationEmail(auth as unknown as Auth,{child:()=>({transaction})} as unknown as Reference)
  return {handler,auth,transaction}
}
it('sends to the authenticated account, ignoring caller-supplied recipients and links',async()=>{
  const {handler,auth}=setup()
  await handler({email:'other@example.test',link:'https://evil.test'},{auth:{uid:'owner'}})
  expect(auth.getUser).toHaveBeenCalledWith('owner')
  expect(send.mock.calls[0][0]).toMatchObject({To:'owner@example.test',TemplateAlias:'verify-email',TrackOpens:false,TrackLinks:'None',TemplateModel:{verification:{link:'https://connect.scotdance.app/verify-email?oobCode=secret'}}})
})
it('requires a signed-in account',async()=>{await expect(setup().handler({},{})).rejects.toMatchObject({code:'unauthenticated'});expect(send).not.toHaveBeenCalled()})
it('skips verified accounts and throttles repeated requests',async()=>{
  await expect(setup(true).handler({},{auth:{uid:'owner'}})).resolves.toEqual({verified:true})
  await expect(setup(false,false).handler({},{auth:{uid:'owner'}})).rejects.toMatchObject({code:'resource-exhausted'})
  expect(send).not.toHaveBeenCalled()
})
it('does not claim delivery when Postmark fails',async()=>{send.mockRejectedValue(new Error('failed'));await expect(setup().handler({},{auth:{uid:'owner'}})).rejects.toMatchObject({code:'unavailable'})})
it('keeps only the verification code in a fixed first-party URL',()=>{expect(()=>verificationLink('https://example.test/?mode=resetPassword&oobCode=secret')).toThrow();expect(verificationLink('https://example.test/?mode=verifyEmail&oobCode=abc&continueUrl=https://evil.test')).toBe('https://connect.scotdance.app/verify-email?oobCode=abc')})
