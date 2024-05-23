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
    fields: ['displayName', 'formattedAddress', 'addressComponents'],
  });
  return places;
}
export function getPlaceFields(placeObject) {
  const streetNumber = placeObject.addressComponents.find((component) => (component.types).includes('street_number'));
  const route = placeObject.addressComponents.find((component) => (component.types).includes('route'));
  const locality = placeObject.addressComponents.find((component) => (component.types).includes('locality'));
  const administrativeAreaLevel1 = placeObject.addressComponents.find((component) => (component.types).includes('administrative_area_level_1'));

  return {
    venue: placeObject.displayName,
    address: [streetNumber?.shortText, route?.shortText].filter(Boolean).join(' '),
    location: [locality?.shortText, administrativeAreaLevel1?.shortText].filter(Boolean).join(', '),
  };
}
