// `npm run store:stack`: the store stack with the demo data, left running so
// the shots can be retaken (and the demo app browsed) without a restart.
import { APP_URL, startStack } from './stack.ts'
import { seedDemo } from './demo.ts'

const stack = await startStack()
await seedDemo()
console.log(
  `Demo data in. Browse ${APP_URL}, or run \`npm run store\` beside this. Ctrl-C stops.`,
)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await stack.stop()
    process.exit(0)
  })
}
