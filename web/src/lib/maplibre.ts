import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl, { type Map as MaplibreMap, type MapOptions } from 'maplibre-gl'
import { guessUserCountry } from '@/lib/locale'

// OpenFreeMap free public tiles — no auth, attribution required. To swap to
// MapTiler or Stadia, only this URL changes; the renderer code stays put.
const TILE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

// Country-centred starting views for the Highland-dance markets. Zoom is set
// so the whole country roughly fits on a phone-sized viewport.
const COUNTRY_CAMERA: Record<string, { center: [number, number]; zoom: number }> = {
  GB: { center: [-2, 54], zoom: 5 },
  IE: { center: [-8, 53], zoom: 6 },
  CA: { center: [-96, 60], zoom: 3 },
  US: { center: [-98, 39], zoom: 3 },
  AU: { center: [134, -25], zoom: 3 },
  NZ: { center: [172, -41], zoom: 5 },
  ZA: { center: [25, -29], zoom: 5 },
}

const guessed = guessUserCountry()
const initial = (guessed && COUNTRY_CAMERA[guessed]) || { center: [0, 20] as [number, number], zoom: 1 }
export const DEFAULT_CENTER: [number, number] = initial.center
export const DEFAULT_ZOOM = initial.zoom

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
      Array.isArray(data?.center)
      && data.center.length === 2
      && Number.isFinite(data.center[0])
      && Number.isFinite(data.center[1])
      && Number.isFinite(data?.zoom)
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
  const persisted = readPersistedCamera()
  const map = new maplibregl.Map({
    container,
    style: TILE_STYLE_URL,
    center: persisted?.center ?? DEFAULT_CENTER,
    zoom: persisted?.zoom ?? DEFAULT_ZOOM,
    attributionControl: { compact: true },
    ...opts,
  })
  map.on('error', (e) => {
    console.error('[maplibre]', e?.error ?? e)
  })
  return map
}
