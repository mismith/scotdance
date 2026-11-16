import * as maps from '@/lib/maps'
export type { PlaceSuggestion } from '@/lib/maps'
// Fictional local previews never call Google. Production uses the existing Places integration.
const examples = [
  {
    placeId: 'demo-calgary',
    primaryText: 'Calgary',
    secondaryText: 'AB, Canada',
    town: 'Calgary',
    province: 'AB',
    country: 'Canada',
  },
  {
    placeId: 'demo-canmore',
    primaryText: 'Canmore',
    secondaryText: 'AB, Canada',
    town: 'Canmore',
    province: 'AB',
    country: 'Canada',
  },
  {
    placeId: 'demo-glasgow',
    primaryText: 'Glasgow',
    secondaryText: 'Scotland, United Kingdom',
    town: 'Glasgow',
    province: 'Scotland',
    country: 'United Kingdom',
  },
]
export const placesAvailable = import.meta.env.DEV || maps.placesAvailable
export const fetchTownSuggestions = (text: string) =>
  import.meta.env.DEV
    ? Promise.resolve(
        examples.filter((p) =>
          p.primaryText.toLowerCase().includes(text.trim().toLowerCase()),
        ),
      )
    : maps.fetchTownSuggestions(text)
export const resolveTown = (id: string) => {
  if (!import.meta.env.DEV) return maps.resolveTown(id)
  const place = examples.find((p) => p.placeId === id)
  if (!place) return Promise.reject(new Error('Choose a sample city.'))
  return Promise.resolve({
    town: place.town,
    province: place.province,
    country: place.country,
  })
}
