import type {
  AppState,
  AppConfig,
  BookingRequest,
  MatchResult,
  Trip,
  TripStop,
  Booking,
  Vehicle,
  DebugLogEntry,
} from '../types';
import { getRoute } from './googleMapsService';
import { generateLogId, generateStopId } from '../utils/idGenerator';
import { addMinutes, addSeconds, differenceInMinutes } from '../utils/timeUtils';

type LogCallback = (entry: DebugLogEntry) => void;
let logCallback: LogCallback | null = null;

export function setMatchingLogCallback(callback: LogCallback): void {
  logCallback = callback;
}

function log(action: string, details: Record<string, unknown>): void {
  if (logCallback) {
    logCallback({
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      category: 'algorithm',
      action,
      details,
    });
  }
}

interface PoolCandidate {
  trip: Trip;
  newStops: TripStop[];
  estimatedPickupTime: Date;
  estimatedDropoffTime: Date;
  score: number;
  routePolyline: string;
}

export async function findBestMatch(
  request: BookingRequest,
  state: AppState,
  config: AppConfig
): Promise<MatchResult> {
  log('match_start', {
    pickupLocation: request.pickupLocation,
    dropoffLocation: request.dropoffLocation,
    requestedPickupTime: request.requestedPickupTime,
    passengerCount: request.passengerCount,
  });

  const requestedPickup = new Date(request.requestedPickupTime);
  const candidates: PoolCandidate[] = [];

  // Step 1: Find all planned trips that could potentially accommodate
  const plannedTrips = state.trips.filter(t => t.status === 'planned');

  log('checking_planned_trips', { count: plannedTrips.length });

  for (const trip of plannedTrips) {
    const tripDeparture = new Date(trip.departureTime);
    const lastStopTime = trip.stops.length > 0
      ? new Date(trip.stops[trip.stops.length - 1].scheduledTime)
      : tripDeparture;

    // Check time compatibility
    if (tripDeparture > addMinutes(requestedPickup, 30)) {
      log('skip_trip', { tripId: trip.id, reason: 'Trip departs too late' });
      continue;
    }

    if (lastStopTime < addMinutes(requestedPickup, -30)) {
      log('skip_trip', { tripId: trip.id, reason: 'Trip ends too early' });
      continue;
    }

    // Try to insert the new booking into this trip
    const result = await tryInsertIntoTrip(trip, request, state, config);

    if (result) {
      candidates.push(result);
    }
  }

  // Step 2: Select best candidate (most existing passengers)
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];

    log('match_found', {
      type: 'pool',
      tripId: bestMatch.trip.id,
      existingPassengers: bestMatch.score,
      estimatedPickupTime: bestMatch.estimatedPickupTime.toISOString(),
      estimatedDropoffTime: bestMatch.estimatedDropoffTime.toISOString(),
    });

    return {
      type: 'pool',
      tripId: bestMatch.trip.id,
      vehicleId: bestMatch.trip.vehicleId,
      estimatedPickupTime: bestMatch.estimatedPickupTime.toISOString(),
      estimatedDropoffTime: bestMatch.estimatedDropoffTime.toISOString(),
      routePolyline: bestMatch.routePolyline,
      newStops: bestMatch.newStops,
    };
  }

  // Step 3: Try to create new trip
  const availableVehicle = findAvailableVehicle(
    requestedPickup,
    state.vehicles,
    state.trips,
    config
  );

  if (availableVehicle) {
    log('creating_new_trip', { vehicleId: availableVehicle.id });

    // Get direct route for new trip
    const routeResult = await getRoute(request.pickupLocation, request.dropoffLocation);

    if (!routeResult) {
      log('match_rejected', { reason: 'Could not calculate route' });
      return { type: 'rejected', reason: 'Could not calculate route' };
    }

    const pickupTime = requestedPickup;
    const dropoffTime = addSeconds(pickupTime, routeResult.duration);

    // Create stops for new trip
    const newStops: TripStop[] = [
      {
        id: generateStopId(),
        location: request.pickupLocation,
        address: request.pickupAddress,
        type: 'pickup',
        bookingId: '', // Will be set when booking is created
        scheduledTime: pickupTime.toISOString(),
        sequence: 0,
      },
      {
        id: generateStopId(),
        location: request.dropoffLocation,
        address: request.dropoffAddress,
        type: 'dropoff',
        bookingId: '', // Will be set when booking is created
        scheduledTime: dropoffTime.toISOString(),
        sequence: 1,
      },
    ];

    log('match_found', {
      type: 'new',
      vehicleId: availableVehicle.id,
      estimatedPickupTime: pickupTime.toISOString(),
      estimatedDropoffTime: dropoffTime.toISOString(),
    });

    return {
      type: 'new',
      vehicleId: availableVehicle.id,
      estimatedPickupTime: pickupTime.toISOString(),
      estimatedDropoffTime: dropoffTime.toISOString(),
      routePolyline: routeResult.polyline,
      newStops,
    };
  }

  // Step 4: No solution
  log('match_rejected', { reason: 'No vehicle available' });
  return { type: 'rejected', reason: 'No vehicle available for this time slot' };
}

async function tryInsertIntoTrip(
  trip: Trip,
  request: BookingRequest,
  state: AppState,
  config: AppConfig
): Promise<PoolCandidate | null> {
  const existingStops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);

  // Get bookings for this trip
  const tripBookings = state.bookings.filter(
    b => b.tripId === trip.id && b.status === 'confirmed'
  );

  // Count existing passengers
  const existingPassengerCount = tripBookings.reduce((sum, b) => sum + b.passengerCount, 0);

  // Try different insertion positions for pickup and dropoff
  for (let pickupPos = 0; pickupPos <= existingStops.length; pickupPos++) {
    for (let dropoffPos = pickupPos + 1; dropoffPos <= existingStops.length + 1; dropoffPos++) {
      const result = await evaluateInsertion(
        trip,
        existingStops,
        tripBookings,
        request,
        pickupPos,
        dropoffPos,
        existingPassengerCount,
        config
      );

      if (result) {
        return result;
      }
    }
  }

  return null;
}

async function evaluateInsertion(
  trip: Trip,
  existingStops: TripStop[],
  tripBookings: Booking[],
  request: BookingRequest,
  pickupPos: number,
  dropoffPos: number,
  existingPassengerCount: number,
  config: AppConfig
): Promise<PoolCandidate | null> {
  // Build new stop list with inserted pickup and dropoff
  const newPickupStop: TripStop = {
    id: generateStopId(),
    location: request.pickupLocation,
    address: request.pickupAddress,
    type: 'pickup',
    bookingId: '', // Will be set later
    scheduledTime: request.requestedPickupTime,
    sequence: pickupPos,
  };

  const newDropoffStop: TripStop = {
    id: generateStopId(),
    location: request.dropoffLocation,
    address: request.dropoffAddress,
    type: 'dropoff',
    bookingId: '', // Will be set later
    scheduledTime: '', // Will be calculated
    sequence: dropoffPos,
  };

  // Build new stop sequence
  const newStops: TripStop[] = [];
  let insertedPickup = false;
  let insertedDropoff = false;

  for (let i = 0; i <= existingStops.length; i++) {
    if (i === pickupPos && !insertedPickup) {
      newStops.push(newPickupStop);
      insertedPickup = true;
    }
    if (i === dropoffPos - (insertedPickup ? 0 : 1) && !insertedDropoff && insertedPickup) {
      // Adjust for the pickup we just inserted
    }
    if (i < existingStops.length) {
      newStops.push({ ...existingStops[i] });
    }
  }

  // Rebuild with correct sequencing
  const rebuiltStops: TripStop[] = [];
  let seq = 0;

  for (let i = 0; i <= existingStops.length; i++) {
    if (i === pickupPos) {
      rebuiltStops.push({ ...newPickupStop, sequence: seq++ });
    }
    if (i === dropoffPos) {
      rebuiltStops.push({ ...newDropoffStop, sequence: seq++ });
    }
    if (i < existingStops.length) {
      rebuiltStops.push({ ...existingStops[i], sequence: seq++ });
    }
  }

  // Handle case where dropoff is at the end
  if (dropoffPos === existingStops.length + 1) {
    rebuiltStops.push({ ...newDropoffStop, sequence: seq++ });
  }

  // Get coordinates for route calculation
  const routePoints = rebuiltStops.map(s => s.location);

  if (routePoints.length < 2) {
    return null;
  }

  // Calculate route with all stops
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1);

  const routeResult = await getRoute(origin, destination, waypoints);

  if (!routeResult) {
    log('insertion_rejected', {
      tripId: trip.id,
      pickupPos,
      dropoffPos,
      reason: 'Route calculation failed',
    });
    return null;
  }

  // Calculate scheduled times for each stop
  const tripDeparture = new Date(trip.departureTime);
  let currentTime = tripDeparture;
  const updatedStops: TripStop[] = [];

  for (let i = 0; i < rebuiltStops.length; i++) {
    const stop = rebuiltStops[i];

    if (i > 0 && routeResult.legs[i - 1]) {
      currentTime = addSeconds(currentTime, routeResult.legs[i - 1].duration);
    }

    // Add stop time
    currentTime = addMinutes(currentTime, config.minutesPerStop);

    updatedStops.push({
      ...stop,
      scheduledTime: currentTime.toISOString(),
    });
  }

  // Find the new booking's pickup and dropoff times
  const newPickupIdx = updatedStops.findIndex(s => s.id === newPickupStop.id);
  const newDropoffIdx = updatedStops.findIndex(s => s.id === newDropoffStop.id);

  if (newPickupIdx === -1 || newDropoffIdx === -1) {
    return null;
  }

  const estimatedPickupTime = new Date(updatedStops[newPickupIdx].scheduledTime);
  const estimatedDropoffTime = new Date(updatedStops[newDropoffIdx].scheduledTime);

  // Check capacity at each segment
  let passengersOnBoard = 0;

  for (const stop of updatedStops) {
    if (stop.type === 'pickup') {
      // Find passenger count for this pickup
      const booking = tripBookings.find(b => b.id === stop.bookingId);
      const paxCount = booking ? booking.passengerCount :
        (stop.id === newPickupStop.id ? request.passengerCount : 0);
      passengersOnBoard += paxCount;

      if (passengersOnBoard > config.seatsPerVehicle) {
        log('insertion_rejected', {
          tripId: trip.id,
          pickupPos,
          dropoffPos,
          reason: 'Exceeds vehicle capacity',
          passengersOnBoard,
          capacity: config.seatsPerVehicle,
        });
        return null;
      }
    } else if (stop.type === 'dropoff') {
      const booking = tripBookings.find(b => b.id === stop.bookingId);
      const paxCount = booking ? booking.passengerCount :
        (stop.id === newDropoffStop.id ? request.passengerCount : 0);
      passengersOnBoard -= paxCount;
    }
  }

  // Check detour constraint for existing passengers
  for (const booking of tripBookings) {
    const originalDropoffTime = new Date(booking.estimatedDropoffTime);
    const dropoffStop = updatedStops.find(
      s => s.bookingId === booking.id && s.type === 'dropoff'
    );

    if (dropoffStop) {
      const newDropoffTime = new Date(dropoffStop.scheduledTime);
      const delayMinutes = differenceInMinutes(newDropoffTime, originalDropoffTime);

      if (delayMinutes > config.maxDetourMinutes) {
        log('insertion_rejected', {
          tripId: trip.id,
          pickupPos,
          dropoffPos,
          reason: `Exceeds detour limit for booking ${booking.bookingNumber}`,
          delayMinutes,
          maxDetour: config.maxDetourMinutes,
        });
        return null;
      }
    }
  }

  // Check new passenger's dropoff guarantee
  const directRoute = await getRoute(request.pickupLocation, request.dropoffLocation);
  if (directRoute) {
    const directDropoffTime = addSeconds(estimatedPickupTime, directRoute.duration);
    const actualDelay = differenceInMinutes(estimatedDropoffTime, directDropoffTime);

    if (actualDelay > config.maxDetourMinutes) {
      log('insertion_rejected', {
        tripId: trip.id,
        pickupPos,
        dropoffPos,
        reason: 'Cannot guarantee dropoff time for new passenger',
        actualDelay,
        maxDetour: config.maxDetourMinutes,
      });
      return null;
    }
  }

  // Check that pickup time is close to requested
  const requestedPickup = new Date(request.requestedPickupTime);
  const pickupDiff = Math.abs(differenceInMinutes(estimatedPickupTime, requestedPickup));

  if (pickupDiff > 15) {
    log('insertion_rejected', {
      tripId: trip.id,
      pickupPos,
      dropoffPos,
      reason: 'Pickup time too far from requested',
      pickupDiff,
    });
    return null;
  }

  log('insertion_accepted', {
    tripId: trip.id,
    pickupPos,
    dropoffPos,
    estimatedPickupTime: estimatedPickupTime.toISOString(),
    estimatedDropoffTime: estimatedDropoffTime.toISOString(),
  });

  return {
    trip,
    newStops: updatedStops,
    estimatedPickupTime,
    estimatedDropoffTime,
    score: existingPassengerCount,
    routePolyline: routeResult.polyline,
  };
}

function findAvailableVehicle(
  requestedTime: Date,
  vehicles: Vehicle[],
  trips: Trip[],
  _config: AppConfig
): Vehicle | null {
  for (const vehicle of vehicles) {
    const vehicleTrips = trips.filter(
      t => t.vehicleId === vehicle.id && t.status !== 'completed' && t.status !== 'cancelled'
    );

    // Check if vehicle is free around the requested time
    let isAvailable = true;

    for (const trip of vehicleTrips) {
      const tripStart = new Date(trip.departureTime);
      const lastStop = trip.stops[trip.stops.length - 1];
      const tripEnd = lastStop ? new Date(lastStop.scheduledTime) : tripStart;

      // Add buffer for travel to next pickup
      const bufferEnd = addMinutes(tripEnd, 30);

      // Check for overlap
      if (requestedTime >= tripStart && requestedTime <= bufferEnd) {
        isAvailable = false;
        break;
      }
    }

    if (isAvailable) {
      log('vehicle_available', { vehicleId: vehicle.id, requestedTime: requestedTime.toISOString() });
      return vehicle;
    }
  }

  log('no_vehicle_available', { requestedTime: requestedTime.toISOString() });
  return null;
}

export function getPassengersAtStop(
  stops: TripStop[],
  bookings: Booking[],
  stopIndex: number
): number {
  let passengers = 0;

  for (let i = 0; i <= stopIndex; i++) {
    const stop = stops[i];
    const booking = bookings.find(b => b.id === stop.bookingId);
    const paxCount = booking?.passengerCount || 0;

    if (stop.type === 'pickup') {
      passengers += paxCount;
    } else {
      passengers -= paxCount;
    }
  }

  return passengers;
}
