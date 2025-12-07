import type {
  AppState,
  AppConfig,
  BookingRequest,
  MatchResult,
  Trip,
  TripStop,
  Booking,
  Vehicle,
  Coordinates,
  DebugLogEntry,
} from '../types';
import { getRoute } from './googleMapsService';
import { generateLogId, generateStopId } from '../utils/idGenerator';
import { addMinutes, addSeconds, differenceInMinutes, formatTime } from '../utils/timeUtils';

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
  estimatedDuration: number; // seconds
  score: number;
  routePolyline: string;
}

interface VehicleAvailabilityResult {
  vehicle: Vehicle | null;
  earliestAvailableTime: Date | null; // Earliest time any vehicle could arrive at pickup
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
      estimatedDurationSeconds: bestMatch.estimatedDuration,
    });

    return {
      type: 'pool',
      tripId: bestMatch.trip.id,
      vehicleId: bestMatch.trip.vehicleId,
      estimatedPickupTime: bestMatch.estimatedPickupTime.toISOString(),
      estimatedDropoffTime: bestMatch.estimatedDropoffTime.toISOString(),
      estimatedDuration: bestMatch.estimatedDuration,
      routePolyline: bestMatch.routePolyline,
      newStops: bestMatch.newStops,
    };
  }

  // Step 3: Try to create new trip
  // First calculate route to get accurate duration for vehicle availability check
  log('calculating_route_for_new_trip', {
    from: request.pickupLocation,
    to: request.dropoffLocation,
  });

  const routeResult = await getRoute(request.pickupLocation, request.dropoffLocation);

  if (!routeResult) {
    log('match_rejected', { reason: 'Could not calculate route' });
    return { type: 'rejected', reason: 'Could not calculate route' };
  }

  const tripDurationSeconds = routeResult.duration;
  log('route_calculated', {
    durationSeconds: tripDurationSeconds,
    durationMinutes: Math.round(tripDurationSeconds / 60),
    distanceMeters: routeResult.distance,
  });

  // Now check vehicle availability using actual trip duration
  const availabilityResult = await findAvailableVehicle(
    requestedPickup,
    tripDurationSeconds,
    request.pickupLocation,
    state.vehicles,
    state.trips,
    config
  );

  if (availabilityResult.vehicle) {
    log('creating_new_trip', { vehicleId: availabilityResult.vehicle.id });

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
      vehicleId: availabilityResult.vehicle.id,
      estimatedPickupTime: pickupTime.toISOString(),
      estimatedDropoffTime: dropoffTime.toISOString(),
      estimatedDurationSeconds: tripDurationSeconds,
    });

    return {
      type: 'new',
      vehicleId: availabilityResult.vehicle.id,
      estimatedPickupTime: pickupTime.toISOString(),
      estimatedDropoffTime: dropoffTime.toISOString(),
      estimatedDuration: tripDurationSeconds,
      routePolyline: routeResult.polyline,
      newStops,
    };
  }

  // Step 4: No solution - include earliest available time in message
  const earliestTime = availabilityResult.earliestAvailableTime;
  const reason = earliestTime
    ? `No vehicle available at ${formatTime(requestedPickup)}. Earliest available: ${formatTime(earliestTime)}`
    : 'No vehicle available for this time slot';

  log('match_rejected', {
    reason,
    earliestAvailableTime: earliestTime?.toISOString(),
  });

  return {
    type: 'rejected',
    reason,
    earliestAvailableTime: earliestTime?.toISOString(),
  };
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
    totalDurationSeconds: routeResult.duration,
  });

  return {
    trip,
    newStops: updatedStops,
    estimatedPickupTime,
    estimatedDropoffTime,
    estimatedDuration: routeResult.duration,
    score: existingPassengerCount,
    routePolyline: routeResult.polyline,
  };
}

async function findAvailableVehicle(
  requestedTime: Date,
  tripDurationSeconds: number,
  pickupLocation: Coordinates,
  vehicles: Vehicle[],
  trips: Trip[],
  config: AppConfig
): Promise<VehicleAvailabilityResult> {
  const tripDurationMinutes = Math.ceil(tripDurationSeconds / 60) + config.minutesPerStop;
  const newTripEnd = addMinutes(requestedTime, tripDurationMinutes);

  log('checking_vehicle_availability', {
    requestedTime: requestedTime.toISOString(),
    tripDurationMinutes,
    newTripEnd: newTripEnd.toISOString(),
    bufferMinutes: config.bufferMinutes,
  });

  let earliestArrivalTime: Date | null = null;

  for (const vehicle of vehicles) {
    // Get all active trips for this vehicle, sorted by departure time
    const vehicleTrips = trips
      .filter(t => t.vehicleId === vehicle.id && t.status !== 'completed' && t.status !== 'cancelled')
      .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

    // First, check for any trip that overlaps with the new trip's time window
    const overlappingTrip = findOverlappingTrip(vehicleTrips, requestedTime, newTripEnd);

    if (overlappingTrip) {
      // Vehicle is busy with an overlapping trip - calculate when it will be free
      const lastStop = overlappingTrip.stops[overlappingTrip.stops.length - 1];
      const overlappingTripEnd = lastStop ? new Date(lastStop.scheduledTime) : new Date(overlappingTrip.departureTime);

      log('overlapping_trip_detected', {
        vehicleId: vehicle.id,
        overlappingTripId: overlappingTrip.id,
        tripStart: new Date(overlappingTrip.departureTime).toISOString(),
        tripEnd: overlappingTripEnd.toISOString(),
        requestedTime: requestedTime.toISOString(),
        newTripEnd: newTripEnd.toISOString(),
      });

      // Calculate travel time from overlapping trip's end to pickup location
      if (lastStop) {
        const travelRoute = await getRoute(lastStop.location, pickupLocation);
        if (travelRoute) {
          const vehicleAvailableAt = addSeconds(overlappingTripEnd, travelRoute.duration);
          const vehicleReadyAt = addMinutes(vehicleAvailableAt, config.bufferMinutes);

          if (!earliestArrivalTime || vehicleReadyAt < earliestArrivalTime) {
            earliestArrivalTime = vehicleReadyAt;
          }
        }
      }

      continue; // Skip to next vehicle
    }

    // Find the trip that ends just before the requested pickup time
    const priorTrip = findPriorTrip(vehicleTrips, requestedTime);

    // Find the trip that starts after the new trip would end
    const nextTrip = findNextTrip(vehicleTrips, newTripEnd);

    let canArriveInTime = true;
    let vehicleArrivalTime: Date | null = null;

    // Check if vehicle can travel from prior trip's last stop to new pickup in time
    if (priorTrip) {
      const lastStop = priorTrip.stops[priorTrip.stops.length - 1];
      if (lastStop) {
        const priorTripEndTime = new Date(lastStop.scheduledTime);
        const priorTripEndLocation = lastStop.location;

        // Calculate travel time from prior trip end to new pickup
        const travelRoute = await getRoute(priorTripEndLocation, pickupLocation);

        if (travelRoute) {
          const travelTimeSeconds = travelRoute.duration;
          vehicleArrivalTime = addSeconds(priorTripEndTime, travelTimeSeconds);

          // Vehicle must arrive at pickup location with buffer before requested time
          const requiredArrivalTime = addMinutes(requestedTime, -config.bufferMinutes);

          log('travel_time_check', {
            vehicleId: vehicle.id,
            priorTripId: priorTrip.id,
            priorTripEndTime: priorTripEndTime.toISOString(),
            travelTimeMinutes: Math.round(travelTimeSeconds / 60),
            vehicleArrivalTime: vehicleArrivalTime.toISOString(),
            requiredArrivalTime: requiredArrivalTime.toISOString(),
            bufferMinutes: config.bufferMinutes,
          });

          if (vehicleArrivalTime > requiredArrivalTime) {
            canArriveInTime = false;
            // Calculate when this vehicle could actually be available (arrival + buffer)
            vehicleArrivalTime = addMinutes(vehicleArrivalTime, config.bufferMinutes);
          }
        } else {
          // Could not calculate route, assume vehicle is not available
          log('travel_route_failed', {
            vehicleId: vehicle.id,
            from: priorTripEndLocation,
            to: pickupLocation,
          });
          canArriveInTime = false;
        }
      }
    }

    // Check if new trip would conflict with a subsequent trip
    if (canArriveInTime && nextTrip) {
      const nextTripStart = new Date(nextTrip.departureTime);
      const nextTripPickupLocation = nextTrip.stops[0]?.location;

      if (nextTripPickupLocation) {
        // Calculate travel time from new trip's dropoff to next trip's pickup
        // For simplicity, we check if there's enough time gap
        const gapMinutes = differenceInMinutes(nextTripStart, newTripEnd);

        if (gapMinutes < config.bufferMinutes) {
          log('conflict_with_next_trip', {
            vehicleId: vehicle.id,
            nextTripId: nextTrip.id,
            newTripEnd: newTripEnd.toISOString(),
            nextTripStart: nextTripStart.toISOString(),
            gapMinutes,
          });
          canArriveInTime = false;
        }
      }
    }

    // Track earliest arrival time across all vehicles
    if (vehicleArrivalTime && (!earliestArrivalTime || vehicleArrivalTime < earliestArrivalTime)) {
      earliestArrivalTime = vehicleArrivalTime;
    }

    if (canArriveInTime) {
      log('vehicle_available', {
        vehicleId: vehicle.id,
        requestedTime: requestedTime.toISOString(),
        hasPriorTrip: !!priorTrip,
      });
      return { vehicle, earliestAvailableTime: null };
    }
  }

  log('no_vehicle_available', {
    requestedTime: requestedTime.toISOString(),
    earliestAvailableTime: earliestArrivalTime?.toISOString(),
  });

  return { vehicle: null, earliestAvailableTime: earliestArrivalTime };
}

// Find the trip that ends just before the requested time
function findPriorTrip(sortedTrips: Trip[], requestedTime: Date): Trip | null {
  let priorTrip: Trip | null = null;

  for (const trip of sortedTrips) {
    const lastStop = trip.stops[trip.stops.length - 1];
    const tripEndTime = lastStop ? new Date(lastStop.scheduledTime) : new Date(trip.departureTime);

    if (tripEndTime <= requestedTime) {
      priorTrip = trip; // Keep the latest one that ends before requested time
    } else {
      break; // Trips are sorted, so we can stop once we pass requestedTime
    }
  }

  return priorTrip;
}

// Find the trip that starts after the given time
function findNextTrip(sortedTrips: Trip[], afterTime: Date): Trip | null {
  for (const trip of sortedTrips) {
    const tripStart = new Date(trip.departureTime);
    if (tripStart > afterTime) {
      return trip;
    }
  }
  return null;
}

// Find any trip that overlaps with the given time window
// A trip overlaps if it starts before the new trip ends AND ends after the new trip starts
function findOverlappingTrip(sortedTrips: Trip[], newTripStart: Date, newTripEnd: Date): Trip | null {
  for (const trip of sortedTrips) {
    const tripStart = new Date(trip.departureTime);
    const lastStop = trip.stops[trip.stops.length - 1];
    const tripEnd = lastStop ? new Date(lastStop.scheduledTime) : tripStart;

    // Trip overlaps if: tripStart < newTripEnd AND tripEnd > newTripStart
    if (tripStart < newTripEnd && tripEnd > newTripStart) {
      return trip;
    }
  }
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
