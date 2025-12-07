import type { AppConfig, Vehicle } from './types';

export const LA_REUNION_CENTER = { lat: -21.1151, lng: 55.5364 };
export const DEFAULT_ZOOM = 10;

export const STORAGE_KEYS = {
  STATE: 'transport_poc_state',
  CONFIG: 'transport_poc_config',
} as const;

export const DEFAULT_CONFIG: AppConfig = {
  vehicleCount: 3,
  seatsPerVehicle: 8,
  maxDetourMinutes: 8,
  minutesPerStop: 2,
  bufferMinutes: 5,
  googleMapsApiKey: 'AIzaSyDaenxvBTuIbogoh93C-V5hCh6rfvgngsM',
};

export const DEFAULT_VEHICLES: Vehicle[] = [
  { id: 'v1', name: 'Vehicle 1', color: '#3B82F6', capacity: 8, currentLocation: null },
  { id: 'v2', name: 'Vehicle 2', color: '#22C55E', capacity: 8, currentLocation: null },
  { id: 'v3', name: 'Vehicle 3', color: '#F97316', capacity: 8, currentLocation: null },
];

export const VEHICLE_COLORS = {
  v1: '#3B82F6', // Blue
  v2: '#22C55E', // Green
  v3: '#F97316', // Orange
} as const;
