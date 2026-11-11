/**
 * New database keys, made here the way the Firebase SDKs make them (push ids: 8 characters of time, 12 of
 * randomness, so keys sort by creation). Made on the server, with no round trip, as the app makes them on a device.
 */
const CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

let lastTime = 0;
let lastRandom: number[] = [];

export function pushId(now: number = Date.now(), random: () => number = Math.random): string {
  const duplicate = now === lastTime;
  lastTime = now;
  let time = now;
  const stamp: string[] = [];
  for (let i = 7; i >= 0; i--) {
    stamp[i] = CHARS.charAt(time % 64);
    time = Math.floor(time / 64);
  }
  if (!duplicate) {
    lastRandom = Array.from({ length: 12 }, () => Math.floor(random() * 64));
  } else {
    // Several in the same millisecond: the same random part plus one, so they still sort in the order made
    let i = 11;
    while (i >= 0 && lastRandom[i] === 63) lastRandom[i--] = 0;
    if (i >= 0) lastRandom[i]++;
  }
  return stamp.join('') + lastRandom.map((n) => CHARS.charAt(n)).join('');
}
