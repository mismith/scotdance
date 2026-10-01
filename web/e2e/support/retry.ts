// The functions emulator can briefly answer 503 while aggregate triggers
// from a seed or cleanup fan out. Retry those instead of failing the test
// (or leaving a half-removed competition behind).
export async function retry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= tries || !/\b503\b/.test(String(e))) throw e
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}
