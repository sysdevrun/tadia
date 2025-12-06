import type { Coordinates, TripStop } from '../types';

export function coordinatesToLatLng(coords: Coordinates): google.maps.LatLngLiteral {
  return { lat: coords.lat, lng: coords.lng };
}

export function latLngToCoordinates(latLng: google.maps.LatLng | google.maps.LatLngLiteral): Coordinates {
  if (latLng instanceof google.maps.LatLng) {
    return { lat: latLng.lat(), lng: latLng.lng() };
  }
  return { lat: latLng.lat, lng: latLng.lng };
}

export function sortStopsBySequence(stops: TripStop[]): TripStop[] {
  return [...stops].sort((a, b) => a.sequence - b.sequence);
}

export function getStopsForRoute(stops: TripStop[]): Coordinates[] {
  return sortStopsBySequence(stops).map(stop => stop.location);
}

export function calculateDistance(a: Coordinates, b: Coordinates): number {
  // Haversine formula for approximate distance in meters
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}
