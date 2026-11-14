import { computed, ref, watch } from 'vue'

// Browser caching handles image bytes. Reuse hashes without making a separate
// existence request; d=404 lets each avatar fall back to its own initials.
const hashes = new Map<string, Promise<string>>()
export async function gravatarUrl(email?: string | null): Promise<string | null> {
  const address = email?.trim().toLowerCase()
  if (!address) return null
  let hash = hashes.get(address)
  if (!hash) {
    hash = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(address))
      .then((digest) =>
        [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join(''),
      )
    hashes.set(address, hash)
    void hash.catch(() => hashes.delete(address))
  }
  return `https://www.gravatar.com/avatar/${await hash}?s=200&d=404&r=g`
}

/** A supplied photo, then Gravatar, then the caller's existing initials. */
export function useAvatar(
  identity: () => { email?: string | null; image?: string | null },
) {
  const gravatar = ref<string | null>(null)
  const failed = ref<string[]>([])
  watch(
    () => [identity().email, identity().image] as const,
    async ([email], _, onCleanup) => {
      let current = true
      onCleanup(() => (current = false))
      gravatar.value = null
      failed.value = []
      try {
        const url = await gravatarUrl(email)
        // Switching accounts must never show the previous person's picture.
        if (current) gravatar.value = url
      } catch {
        // An optional photo must not break the account UI.
      }
    },
    { immediate: true, flush: 'sync' },
  )
  const image = computed(
    () =>
      [identity().image, gravatar.value].find(
        (url) => url && !failed.value.includes(url),
      ) || null,
  )
  function onError(event: Event) {
    // A late error from an old image must not hide the new account's photo.
    const src = (event.target as HTMLImageElement).getAttribute('src')
    if (src) failed.value = [...failed.value, src]
  }
  return { image, onError }
}
