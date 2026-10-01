import { reactive, shallowRef } from 'vue'

// App-wide confirmation dialog and toasts (rendered by FeedbackHost.vue).

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'error'
  action?: { label: string; run: () => unknown }
}

export const toasts = reactive<Toast[]>([])
let nextId = 1

export function dismissToast(id: number) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}

/** Show a short message. With an action (e.g. Undo) it stays up longer. */
export function toast(
  message: string,
  opts: { tone?: Toast['tone']; action?: Toast['action'] } = {},
) {
  const id = nextId++
  toasts.push({ id, message, tone: opts.tone ?? 'default', action: opts.action })
  // Keep at most three on screen.
  while (toasts.length > 3) toasts.shift()
  setTimeout(() => dismissToast(id), opts.action ? 8000 : 4000)
  return id
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

export const confirmRequest = shallowRef<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

/** Ask before doing something. Resolves true when confirmed. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  confirmRequest.value?.resolve(false)
  return new Promise((resolve) => {
    confirmRequest.value = {
      ...opts,
      resolve: (ok) => {
        confirmRequest.value = null
        resolve(ok)
      },
    }
  })
}
