// Live blur (glass, the bars' frosting) is drawn afresh on every frame the
// page moves under it, which a low-end Android phone can't keep up with.
// There, glass is solid, as with Reduce Transparency (style.css, data-lite).
// iPhones all draw it fine. `?lite` shows the solid look anywhere.
const nav = navigator as Navigator & { deviceMemory?: number }
const android = /Android/i.test(navigator.userAgent)
const low = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4

export const lite = (android && low) || new URLSearchParams(location.search).has('lite')
if (lite) document.documentElement.dataset.lite = ''
