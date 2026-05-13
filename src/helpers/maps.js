let MapsLoader;
let PlaceApi;
export async function getPlaceApi() {
  if (!MapsLoader) {
    const { Loader } = await import('@googlemaps/js-api-loader');
    MapsLoader = new Loader({
      apiKey: 'AIzaSyD_lDzvFtOTJVXGUAWLAMtGnwa63lyDg8A',
      libraries: ['places'],
    });
  }
  if (!PlaceApi) {
    const { Place } = await MapsLoader.importLibrary('places');
    PlaceApi = Place;
  }
  return PlaceApi;
}
export async function searchForPlaces(textQuery) {
  if (!textQuery) {
    return [];
  }

  const { places } = await (await getPlaceApi()).searchByText({
    textQuery,
    fields: ['displayName', 'formattedAddress', 'addressComponents', 'location'],
  });
  return places;
}

// Single source of truth for turning a new-Places-API Place object
// into the shape we store on a competition. Used by:
// - src/views/competitions/Submit.vue (initial submission)
// - src/views/competition/admin/Info.vue (post-approval re-pick)
// - src/views/admin/Submissions.vue (reviewer edit)
export function extractPlaceFields(placeObject) {
  const components = placeObject?.addressComponents ?? [];
  const find = (type) => components.find((c) => c.types.includes(type));
  const streetNumber = find('street_number');
  const route = find('route');
  const locality = find('locality');
  const administrativeAreaLevel1 = find('administrative_area_level_1');
  const country = find('country');

  // new Places API exposes LatLng with .lat()/.lng() methods
  const loc = placeObject?.location;
  const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
  const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;

  return {
    venue: placeObject?.displayName ?? null,
    address: [streetNumber?.shortText, route?.shortText].filter(Boolean).join(' ') || null,
    location: [locality?.shortText, administrativeAreaLevel1?.shortText].filter(Boolean).join(', ') || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    country: country?.shortText ?? null,
    region: administrativeAreaLevel1?.shortText ?? null,
    locality: locality?.shortText ?? null,
  };
}

// Back-compat wrapper for callers that only want the original three fields.
export function getPlaceFields(placeObject) {
  const { venue, address, location } = extractPlaceFields(placeObject);
  return { venue, address, location };
}
