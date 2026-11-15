import { describe, expect, it } from 'vitest'
import { accountOwner, ACCOUNT_CHANNEL, CONNECT_ORIGIN } from '../protocol'
describe('account frame', () => {
  it('accepts only its actual Connect parent and a valid owner', () => {
    const parent = {}, data = {channel: ACCOUNT_CHANNEL, type:'init', uid:'account-123'}
    expect(accountOwner({origin:CONNECT_ORIGIN,source:parent,data},parent)).toBe('account-123')
    for(const origin of ['https://entries.scotdance.app','https://connect.scotdance.app.evil.test','http://connect.scotdance.app']) expect(accountOwner({origin,source:parent,data},parent)).toBeNull()
    expect(accountOwner({origin:CONNECT_ORIGIN,source:{},data},parent)).toBeNull()
    expect(accountOwner({origin:CONNECT_ORIGIN,source:parent,data:{...data,uid:'../other'}},parent)).toBeNull()
  })
})
