import { isIPv4, isIPv6 } from 'node:net';

/** Four bytes of a dotted IPv4 address, or null if it isn't strictly one */
function v4Bytes(ip: string): number[] | null {
  if (!isIPv4(ip)) return null;
  return ip.split('.').map(Number);
}

/** Eight 16-bit groups of an IPv6 address (any notation, even a dotted IPv4 tail), or null */
function v6Groups(ip: string): number[] | null {
  if (!isIPv6(ip) || ip.includes('%')) return null;
  let text = ip.toLowerCase();
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const bytes = v4Bytes(tail[1]);
    if (!bytes) return null;
    text =
      text.slice(0, -tail[1].length) +
      ((bytes[0] << 8) | bytes[1]).toString(16) +
      ':' +
      ((bytes[2] << 8) | bytes[3]).toString(16);
  }
  const [head, rest, extra] = text.split('::');
  if (extra !== undefined) return null;
  const left = head ? head.split(':') : [];
  const right = rest ? rest.split(':') : [];
  const fill = rest === undefined ? 0 : 8 - left.length - right.length;
  if (fill < 0 || (rest === undefined && left.length !== 8)) return null;
  const groups = [...left, ...Array<string>(fill).fill('0'), ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

function publicV4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false; // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false; // link-local, incl. the metadata server
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // protocol assignments, documentation
  if (a === 192 && b === 88 && c === 99) return false; // old 6to4 relay
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

/**
 * Whether an address is one on the open internet. Anything we can't parse, or aren't sure of, is not.
 * IPv6 is an allow-list: only global unicast (2000::/3), minus the special ranges inside it. IPv4-mapped
 * addresses (::ffff:a.b.c.d) are judged as the IPv4 address they carry.
 */
export function isPublicAddress(ip: string): boolean {
  const v4 = v4Bytes(ip);
  if (v4) return publicV4(v4);
  const g = v6Groups(ip);
  if (!g) return false;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff)
    return publicV4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);
  if ((g[0] & 0xe000) !== 0x2000) return false; // not global unicast: ::, ::1, fc00::/7, fe80::/10, ff00::/8, NAT64...
  if (g[0] === 0x2001 && (g[1] & 0xfe00) === 0) return false; // 2001::/23 protocol assignments (Teredo...)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x2002) return false; // 6to4 embeds an IPv4 address we'd have to judge
  if (g[0] === 0x3fff && (g[1] & 0xf000) === 0) return false; // documentation
  return true;
}
