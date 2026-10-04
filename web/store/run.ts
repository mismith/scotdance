// `npm run store`: every store shot, from scratch. Starts the store stack
// (or uses one already up: `npm run store:stack`), seeds the demo, captures
// the app on each device, stops the stack, and renders the art into the iOS
// and Android projects (render.ts).
//
//   npm run store                    everything
//   npm run store -- iphone          one device (iphone, ipad, android)
//   npm run store -- iphone home     one device, some scenes (then re-render)
import { captureAll } from './capture.ts'
import { seedDemo } from './demo.ts'
import { DEVICES, type Device } from './devices.ts'
import { render } from './render.ts'
import { running, startStack } from './stack.ts'

const args = process.argv.slice(2)
const picked = args.filter((a): a is Device['id'] => a in DEVICES)
const devices = picked.length ? picked : (Object.keys(DEVICES) as Device['id'][])
const scenes = args.filter((a) => !(a in DEVICES))

const stack = (await running()) ? null : await startStack()
try {
  await seedDemo()
  console.log('Capturing…')
  await captureAll(devices, scenes)
} finally {
  await stack?.stop()
}
console.log('Rendering…')
await render(devices)
console.log('Done: ios/App/fastlane/screenshots/ and android/fastlane/metadata/')
