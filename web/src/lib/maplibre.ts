import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import type { Map as MaplibreMap, MapOptions } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { guessUserCountry } from '@/lib/locale'

// maplibre v6 can't find its worker inside a bundle; `?worker&url` makes Vite
// emit it as a self-contained chunk.
maplibregl.setWorkerUrl(workerUrl)

// OpenFreeMap free public tiles — no auth, attribution required. To swap to
// MapTiler or Stadia, only these URLs change; the renderer code stays put.
const STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const

export function styleUrlFor(dark: boolean): string {
  return dark ? STYLE_URLS.dark : STYLE_URLS.light
}

// Starting views for the Highland-dance markets: the part of each country
// where people live, fitted to whatever size the map is (a fixed zoom that
// fits Canada on a desktop leaves a phone looking at Hudson Bay).
const COUNTRY_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  GB: [[-8, 49.9], [1.8, 58.7]],
  IE: [[-10.5, 51.4], [-5.9, 55.4]],
  CA: [[-127, 42.5], [-57, 56]],
  US: [[-124.5, 25], [-67, 49]],
  AU: [[113, -43.5], [153.6, -10.7]],
  NZ: [[166.4, -47.3], [178.6, -34.4]],
  ZA: [[16.4, -34.9], [32.9, -22.1]],
}

const guessed = guessUserCountry()
const bounds = guessed ? COUNTRY_BOUNDS[guessed] : undefined
const DEFAULT_VIEW: Partial<MapOptions> = bounds
  ? { bounds, fitBoundsOptions: { padding: 16 } }
  : { center: [0, 20], zoom: 1 }

const CAMERA_STORAGE_KEY = 'competitions:map:camera'

interface PersistedCamera {
  center: [number, number]
  zoom: number
}

function readPersistedCamera(): PersistedCamera | null {
  try {
    const raw = sessionStorage.getItem(CAMERA_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (
      Array.isArray(data?.center) &&
      data.center.length === 2 &&
      Number.isFinite(data.center[0]) &&
      Number.isFinite(data.center[1]) &&
      Number.isFinite(data?.zoom)
    ) {
      return data as PersistedCamera
    }
  } catch {
    /* noop — fall through to default */
  }
  return null
}

export function persistCamera(map: MaplibreMap): void {
  const c = map.getCenter()
  const payload: PersistedCamera = {
    center: [c.lng, c.lat],
    zoom: map.getZoom(),
  }
  try {
    sessionStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* noop — quota errors are harmless here */
  }
}

export function createMap(
  container: HTMLElement,
  opts: Partial<MapOptions> = {},
): MaplibreMap {
  // Where the caller doesn't say, pick up where the map was left this
  // session, or start on the visitor's country.
  const persisted = readPersistedCamera()
  const start = opts.center ? {} : persisted ? { center: persisted.center, zoom: persisted.zoom } : DEFAULT_VIEW
  const map = new maplibregl.Map({
    container,
    style: styleUrlFor(false),
    ...start,
    attributionControl: { compact: true },
    ...opts,
  })
  map.on('error', (e) => {
    console.error('[maplibre]', e?.error ?? e)
  })
  // The free basemap asks for a few icons its sprite doesn't have (e.g.
  // "gate"): stand in a blank one rather than warn about each.
  map.setMissingStyleImageResolver((id) => {
    if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) })
  })
  return map
}
