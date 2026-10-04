// The devices the stores want shots for: the screen each is captured at
// (points × scale), and the slot each shot fills on the store page.
export interface Device {
  id: 'iphone' | 'ipad' | 'android'
  platform: 'ios' | 'android'
  /** The app's screen, in points. */
  viewport: { width: number; height: number }
  scale: number
  /** Status bar and home indicator, in points (the app pads for them). */
  safe: { top: number; bottom: number }
  /** The store's slot, in pixels. */
  slot: { width: number; height: number }
  /** The screen's corner radius, in points. */
  radius: number
  /** Text size, as the device's own setting would set it (the app's sizes are rem-based): larger on the tablet, so its UI reads in a thumbnail. */
  text?: number
  /** The art's measures, in the slot's pixels: type sizes, the top margin, and the screen's width. */
  art: { title: number; sub: number; top: number; side: number; screen: number }
}

export const DEVICES: Record<Device['id'], Device> = {
  // App Store, 6.9" (iPhone Air, 16–18 Pro Max): the size the smaller ones scale from.
  iphone: {
    id: 'iphone',
    platform: 'ios',
    viewport: { width: 440, height: 956 },
    scale: 3,
    safe: { top: 62, bottom: 34 },
    slot: { width: 1320, height: 2868 },
    radius: 62,
    art: { title: 158, sub: 56, top: 168, side: 60, screen: 1150 },
  },
  // App Store, 13" iPad (the app runs on iPad, so these are required).
  ipad: {
    id: 'ipad',
    platform: 'ios',
    viewport: { width: 1032, height: 1376 },
    scale: 2,
    safe: { top: 24, bottom: 20 },
    slot: { width: 2064, height: 2752 },
    radius: 18,
    art: { title: 190, sub: 68, top: 156, side: 180, screen: 1800 },
  },
  // Google Play, phone: 9:16 at 1080 or more for promotion.
  android: {
    id: 'android',
    platform: 'android',
    viewport: { width: 412, height: 915 },
    scale: 3,
    safe: { top: 32, bottom: 24 },
    slot: { width: 1080, height: 1920 },
    radius: 40,
    art: { title: 128, sub: 46, top: 104, side: 48, screen: 930 },
  },
}
