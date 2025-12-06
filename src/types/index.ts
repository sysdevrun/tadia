export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Vehicle {
  id: string;
  name: string;
  color: string;
  capacity: number;
  currentLocation: Coordinates | null;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  tripId: string | null;
  pickupLocation: Coordinates;
  pickupAddress: string;
  dropoffLocation: Coordinates;
  dropoffAddress: string;
  requestedPickupTime: string; // ISO string
  estimatedPickupTime: string; // ISO string
  estimatedDropoffTime: string; // ISO string
  passengerCount: number;
  status: 'confirmed' | 'cancelled';
  createdAt: string; // ISO string
}

export interface TripStop {
  id: string;
  location: Coordinates;
  address: string;
  type: 'pickup' | 'dropoff';
  bookingId: string;
  scheduledTime: string; // ISO string
  sequence: number;
}

export interface Trip {
  id: string;
  vehicleId: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  stops: TripStop[];
  routePolyline: string;
  departureTime: string; // ISO string
  estimatedDuration: number; // seconds - computed from Google Maps
  createdAt: string; // ISO string
}

export type DebugCategory = 'api' | 'algorithm' | 'booking' | 'trip';

export interface DebugLogEntry {
  id: string;
  timestamp: string; // ISO string
  category: DebugCategory;
  action: string;
  details: Record<string, unknown>;
}

export interface AppConfig {
  vehicleCount: number;
  seatsPerVehicle: number;
  maxDetourMinutes: number;
  minutesPerStop: number;
  googleMapsApiKey: string;
}

export interface AppState {
  vehicles: Vehicle[];
  bookings: Booking[];
  trips: Trip[];
  debugLog: DebugLogEntry[];
  config: AppConfig;
}

export interface BookingRequest {
  pickupLocation: Coordinates;
  pickupAddress: string;
  dropoffLocation: Coordinates;
  dropoffAddress: string;
  requestedPickupTime: string; // ISO string
  passengerCount: number;
}

export interface MatchResult {
  type: 'pool' | 'new' | 'rejected';
  tripId?: string;
  vehicleId?: string;
  estimatedPickupTime?: string;
  estimatedDropoffTime?: string;
  estimatedDuration?: number; // seconds - computed from Google Maps
  reason?: string;
  routePolyline?: string;
  newStops?: TripStop[];
}

export interface RouteResult {
  duration: number; // seconds
  distance: number; // meters
  polyline: string;
  legs: RouteLeg[];
}

export interface RouteLeg {
  duration: number;
  distance: number;
  startLocation: Coordinates;
  endLocation: Coordinates;
}
