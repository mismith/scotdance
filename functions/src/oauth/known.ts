/**
 * The assistants ScotDance.app knows by their address. Anyone can publish a client document that calls itself "Claude",
 * so the name proves nothing; the address the document lives at does. A client whose `client_id` is on one of
 * these hosts (or a subdomain of one) is shown by name on the approval page; any other is shown by its address,
 * with a warning (ADR 0018), and its errors never redirect (authorize.ts).
 */
export const knownHosts = new Set(['claude.ai', 'claude.com', 'anthropic.com', 'chatgpt.com', 'openai.com']);

/** Whether a `client_id` is an address on a known host: the host itself or one of its subdomains */
export function isKnownClient(clientId: string): boolean {
  let host: string;
  try {
    host = new URL(clientId).hostname;
  } catch {
    return false;
  }
  for (const known of knownHosts) if (host === known || host.endsWith(`.${known}`)) return true;
  return false;
}
