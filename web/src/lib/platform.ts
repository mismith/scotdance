// True on iPhone / iPad / iPod (and iPad-as-Mac since iPadOS 13). Used to
// gate iOS-Safari-only workarounds — every other platform respects
// `position: fixed` while the on-screen keyboard is up.
//
// The vendor check filters out Chrome DevTools' mobile-emulation mode:
// DevTools spoofs `userAgent` but not `navigator.vendor`, so real WebKit
// reads "Apple Computer, Inc." while emulated Chrome stays "Google Inc."
export const isIos =
  typeof navigator !== 'undefined' &&
  navigator.vendor === 'Apple Computer, Inc.' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
