// Asking the `mcp` function's tools over MCP the way an assistant asks (the emulator takes `Bearer dev:<uid>`
// in place of OAuth tokens). Shared by the specs for ADR 0018's tools.

const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
export const MCP = `http://127.0.0.1:${5001 + OFFSET}/firebase-scotdance/us-central1/mcp/mcp`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>

export async function callTool(person: string, name: string, args: Json = {}): Promise<{ isError: boolean; text: string; data: Json }> {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer dev:${person}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const { result } = (await res.json()) as { result: { isError?: boolean; content: Array<{ text: string }>; structuredContent?: Json } }
  return { isError: result.isError === true, text: result.content[0].text, data: result.structuredContent ?? {} }
}
