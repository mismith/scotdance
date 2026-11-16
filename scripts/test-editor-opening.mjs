import assert from 'node:assert/strict'
import { chromium, webkit } from '../web/node_modules/@playwright/test/index.mjs'
const engine = process.argv.includes('--webkit') ? webkit : chromium
const browser = await engine.launch({ headless: true })
try {
  const context = await browser.newContext({viewport:{width:375,height:667},colorScheme:'dark'})
  await context.route('https://**/*', r => r.abort())
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5322/signup?studio=cshd')
  await page.getByRole('button',{name:'Sign in with ScotDance.app'}).click()
  const open = page.getByRole('button',{name:'Edit Isla Fraser'})
  await open.waitFor()
  const originalSize = await open.evaluate(el => ({width:el.offsetWidth,height:el.offsetHeight}))
  let release, started
  const requested = new Promise(resolve => { started = resolve })
  const hold = new Promise(resolve => { release = resolve })
  await page.route('**/dancer-editor.html?*',async route => { started(); await hold; await route.continue() })
  try {
    await open.click()
    await requested
    // Hold the real iframe load so this catches even a one-frame placeholder flash.
    const visible = await page.getByText('Opening ScotDance Connect…',{exact:true}).isVisible()
    console.log('Intermediate opening screen visible:', visible)
    assert.equal(visible, false, 'No intermediate opening screen may appear')
    assert.equal(await page.locator('dialog[data-scotdance-editor]').evaluate(el=>el.open),false,'Do not make the page inert while preparing')
    assert.notEqual(await page.evaluate(()=>document.documentElement.style.overflow),'hidden')
    await open.locator('[data-connect-editor-spinner]').waitFor({state:'visible'})
    assert.equal(await open.getAttribute('aria-busy'),'true')
    assert.deepEqual(await open.evaluate(el => ({width:el.offsetWidth,height:el.offsetHeight})),originalSize,'Loading must not resize the button')
    await page.screenshot({path:'/private/tmp/shared-editor-checks/opening-spinner-'+engine.name()+'.png'})
  } finally { release() }
  const frame=page.frameLocator('iframe[title="ScotDance Connect"]')
  await frame.getByLabel('First name',{exact:true}).waitFor()
  assert.equal(await page.locator('dialog[data-scotdance-editor]').evaluate(el=>el.matches(':modal')),true)
  assert.equal(await open.locator('[data-connect-editor-spinner]').count(),0)
  assert.equal(await open.getAttribute('aria-busy'),null)
  await frame.getByText('Shared only when you consent.',{exact:true}).waitFor()
  await page.screenshot({path:'/private/tmp/shared-editor-checks/branded-editor-'+engine.name()+'.png'})
  await frame.getByRole('button',{name:'Close',exact:true}).click()
  await page.locator('iframe[title="ScotDance Connect"]').waitFor({state:'detached'})
  await page.unroute('**/dancer-editor.html?*')
  // Escape during a delayed opening cancels it; late readiness must not reopen it.
  let releaseCancelled, startedCancelled
  const cancelledRequested = new Promise(resolve => { startedCancelled = resolve })
  const cancelledHold = new Promise(resolve => { releaseCancelled = resolve })
  await page.route('**/dancer-editor.html?*',async route => { startedCancelled(); await cancelledHold; await route.continue().catch(()=>{}) })
  try {
    await open.click(); await cancelledRequested
    await open.locator('[data-connect-editor-spinner]').waitFor({state:'visible'})
    await page.keyboard.press('Escape')
    await page.locator('dialog[data-scotdance-editor]').waitFor({state:'detached'})
    assert.notEqual(await page.evaluate(()=>document.documentElement.style.overflow),'hidden')
    assert.equal(await open.locator('[data-connect-editor-spinner]').count(),0)
    assert.equal(await open.getAttribute('aria-busy'),null)
  } finally { releaseCancelled() }
  await open.waitFor({state:'visible'})
  console.log('PASS',engine.name(),': no loading flash; delayed button spinner without layout shift; branded consent message; pending Escape cancellation')
} finally { await browser.close() }
