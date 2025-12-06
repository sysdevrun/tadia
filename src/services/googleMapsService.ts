import { Loader } from '@googlemaps/js-api-loader';
import type { Coordinates, RouteResult, DebugLogEntry } from '../types';
import { generateLogId } from '../utils/idGenerator';
import { coordinatesToLatLng } from '../utils/routeUtils';

let loader: Loader | null = null;
let mapsLoaded = false;
let directionsService: google.maps.DirectionsService | null = null;
let geocoder: google.maps.Geocoder | null = null;
let placesService: google.maps.places.AutocompleteService | null = null;

type LogCallback = (entry: DebugLogEntry) => void;
let logCallback: LogCallback | null = null;

export function setLogCallback(callback: LogCallback): void {
  logCallback = callback;
}

function log(category: DebugLogEntry['category'], action: string, details: Record<string, unknown>): void {
  if (logCallback) {
    logCallback({
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      category,
      action,
      details,
    });
  }
}

export async function initGoogleMaps(apiKey: string): Promise<boolean> {
  if (!apiKey) {
    log('api', 'init_error', { error: 'No API key provided' });
    return false;
  }

  if (mapsLoaded) {
    return true;
  }

  try {
    loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry'],
    });

    const startTime = Date.now();
    // @ts-expect-error Loader types don't include importLibrary but it's the correct API
    await loader.importLibrary('maps');
    // @ts-expect-error Loader types don't include importLibrary but it's the correct API
    await loader.importLibrary('places');
    // @ts-expect-error Loader types don't include importLibrary but it's the correct API
    await loader.importLibrary('geometry');
    const latencyMs = Date.now() - startTime;

    directionsService = new google.maps.DirectionsService();
    geocoder = new google.maps.Geocoder();
    placesService = new google.maps.places.AutocompleteService();
    mapsLoaded = true;

    log('api', 'init_success', { latencyMs });
    return true;
  } catch (error) {
    log('api', 'init_error', { error: String(error) });
    return false;
  }
}

export function isGoogleMapsLoaded(): boolean {
  return mapsLoaded;
}

export async function getRoute(
  origin: Coordinates,
  destination: Coordinates,
  waypoints?: Coordinates[]
): Promise<RouteResult | null> {
  if (!directionsService) {
    log('api', 'directions_error', { error: 'Directions service not initialized' });
    return null;
  }

  const request: google.maps.DirectionsRequest = {
    origin: coordinatesToLatLng(origin),
    destination: coordinatesToLatLng(destination),
    travelMode: google.maps.TravelMode.DRIVING,
    waypoints: waypoints?.map(wp => ({
      location: coordinatesToLatLng(wp),
      stopover: true,
    })),
    optimizeWaypoints: false, // Keep order as specified
  };

  log('api', 'directions_request', {
    origin,
    destination,
    waypoints: waypoints || [],
  });

  const startTime = Date.now();

  try {
    const result = await directionsService.route(request);
    const latencyMs = Date.now() - startTime;

    if (result.routes.length === 0) {
      log('api', 'directions_error', { error: 'No routes found', latencyMs });
      return null;
    }

    const route = result.routes[0];
    const legs = route.legs.map(leg => ({
      duration: leg.duration?.value || 0,
      distance: leg.distance?.value || 0,
      startLocation: {
        lat: leg.start_location.lat(),
        lng: leg.start_location.lng(),
      },
      endLocation: {
        lat: leg.end_location.lat(),
        lng: leg.end_location.lng(),
      },
    }));

    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);

    const routeResult: RouteResult = {
      duration: totalDuration,
      distance: totalDistance,
      polyline: route.overview_polyline,
      legs,
    };

    log('api', 'directions_response', {
      status: 'OK',
      duration: totalDuration,
      distance: totalDistance,
      latencyMs,
    });

    return routeResult;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    log('api', 'directions_error', {
      error: String(error),
      latencyMs,
    });
    return null;
  }
}

export async function reverseGeocode(location: Coordinates): Promise<string> {
  if (!geocoder) {
    log('api', 'geocode_error', { error: 'Geocoder not initialized' });
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }

  log('api', 'geocode_request', { location });
  const startTime = Date.now();

  try {
    const result = await geocoder.geocode({ location: coordinatesToLatLng(location) });
    const latencyMs = Date.now() - startTime;

    if (result.results.length > 0) {
      const address = result.results[0].formatted_address;
      log('api', 'geocode_response', { status: 'OK', address, latencyMs });
      return address;
    }

    log('api', 'geocode_response', { status: 'ZERO_RESULTS', latencyMs });
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    log('api', 'geocode_error', { error: String(error), latencyMs });
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }
}

export interface PlacePrediction {
  description: string;
  placeId: string;
}

export async function getPlacePredictions(
  input: string,
  location?: Coordinates
): Promise<PlacePrediction[]> {
  if (!placesService) {
    log('api', 'places_error', { error: 'Places service not initialized' });
    return [];
  }

  log('api', 'places_request', { input, location });
  const startTime = Date.now();

  try {
    const request: google.maps.places.AutocompletionRequest = {
      input,
      locationBias: location
        ? new google.maps.Circle({
            center: coordinatesToLatLng(location),
            radius: 50000, // 50km radius around La Réunion
          })
        : undefined,
    };

    const result = await placesService.getPlacePredictions(request);
    const latencyMs = Date.now() - startTime;

    const predictions = result.predictions.map(p => ({
      description: p.description,
      placeId: p.place_id,
    }));

    log('api', 'places_response', {
      status: 'OK',
      count: predictions.length,
      latencyMs,
    });

    return predictions;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    log('api', 'places_error', { error: String(error), latencyMs });
    return [];
  }
}

export async function getPlaceDetails(placeId: string, map: google.maps.Map): Promise<Coordinates | null> {
  log('api', 'place_details_request', { placeId });
  const startTime = Date.now();

  try {
    const service = new google.maps.places.PlacesService(map);

    return new Promise((resolve) => {
      service.getDetails(
        { placeId, fields: ['geometry'] },
        (result, status) => {
          const latencyMs = Date.now() - startTime;

          if (status === google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
            const location: Coordinates = {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
            };
            log('api', 'place_details_response', { status: 'OK', location, latencyMs });
            resolve(location);
          } else {
            log('api', 'place_details_error', { status, latencyMs });
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    log('api', 'place_details_error', { error: String(error), latencyMs });
    return null;
  }
}

export function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}
