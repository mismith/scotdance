/** Whether a caller is an assistant's session: signed in as its owner with a token marked `via: 'mcp'` (ADR 0018) */
export const isAssistant = (auth: { token?: object } | null | undefined) => (auth?.token as { via?: unknown } | undefined)?.via === 'mcp';
