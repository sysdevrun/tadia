import { useState, useEffect, useCallback } from 'react';
import type {
  AppState,
  AppConfig,
  Booking,
  Trip,
  TripStop,
  DebugLogEntry,
  BookingRequest,
} from '../types';
import { loadState, saveState, clearAllData, getDefaultState } from '../services/localStorage';
import { findBestMatch, setMatchingLogCallback } from '../services/matchingAlgorithm';
import { setLogCallback as setGoogleMapsLogCallback } from '../services/googleMapsService';
import {
  generateBookingNumber,
  generateTripId,
  generateStopId,
  generateLogId,
} from '../utils/idGenerator';
import { DEFAULT_VEHICLES } from '../constants';

export function useAppState() {
  const [state, setState] = useState<AppState>(getDefaultState);

  // Load state from localStorage on mount
  useEffect(() => {
    const loadedState = loadState();
    setState(loadedState);
  }, []);

  // Save state to localStorage on changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Set up log callbacks
  const addLogEntry = useCallback((entry: DebugLogEntry) => {
    setState(prev => ({
      ...prev,
      debugLog: [...prev.debugLog, entry],
    }));
  }, []);

  useEffect(() => {
    setMatchingLogCallback(addLogEntry);
    setGoogleMapsLogCallback(addLogEntry);
  }, [addLogEntry]);

  // Config management
  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    setState(prev => {
      const newConfig = { ...prev.config, ...updates };

      // Update vehicles if count changed
      let vehicles = prev.vehicles;
      if (updates.vehicleCount !== undefined && updates.vehicleCount !== prev.config.vehicleCount) {
        vehicles = DEFAULT_VEHICLES.slice(0, updates.vehicleCount).map(v => ({
          ...v,
          capacity: newConfig.seatsPerVehicle,
        }));
      } else if (updates.seatsPerVehicle !== undefined) {
        vehicles = prev.vehicles.map(v => ({
          ...v,
          capacity: updates.seatsPerVehicle!,
        }));
      }

      return {
        ...prev,
        config: newConfig,
        vehicles,
      };
    });
  }, []);

  // Booking management
  const createBooking = useCallback(
    async (request: BookingRequest): Promise<{ booking: Booking; trip: Trip } | { error: string }> => {
      const matchResult = await findBestMatch(request, state, state.config);

      if (matchResult.type === 'rejected') {
        return { error: matchResult.reason || 'Booking rejected' };
      }

      const bookingId = `booking-${Date.now()}`;
      const bookingNumber = generateBookingNumber();

      const booking: Booking = {
        id: bookingId,
        bookingNumber,
        tripId: null,
        pickupLocation: request.pickupLocation,
        pickupAddress: request.pickupAddress,
        dropoffLocation: request.dropoffLocation,
        dropoffAddress: request.dropoffAddress,
        requestedPickupTime: request.requestedPickupTime,
        estimatedPickupTime: matchResult.estimatedPickupTime!,
        estimatedDropoffTime: matchResult.estimatedDropoffTime!,
        passengerCount: request.passengerCount,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      let trip: Trip;

      if (matchResult.type === 'new') {
        // Create new trip
        const tripId = generateTripId();

        // Update stops with booking ID
        const stops: TripStop[] = matchResult.newStops!.map(stop => ({
          ...stop,
          id: generateStopId(),
          bookingId,
        }));

        trip = {
          id: tripId,
          vehicleId: matchResult.vehicleId!,
          status: 'planned',
          stops,
          routePolyline: matchResult.routePolyline!,
          departureTime: matchResult.estimatedPickupTime!,
          createdAt: new Date().toISOString(),
        };

        booking.tripId = tripId;

        setState(prev => ({
          ...prev,
          bookings: [...prev.bookings, booking],
          trips: [...prev.trips, trip],
          debugLog: [
            ...prev.debugLog,
            {
              id: generateLogId(),
              timestamp: new Date().toISOString(),
              category: 'booking',
              action: 'booking_created',
              details: {
                bookingNumber,
                tripId,
                type: 'new_trip',
                vehicleId: matchResult.vehicleId,
              },
            },
          ],
        }));
      } else {
        // Pool into existing trip
        const existingTrip = state.trips.find(t => t.id === matchResult.tripId);
        if (!existingTrip) {
          return { error: 'Trip not found' };
        }

        // Update stops with booking ID for new stops
        const updatedStops: TripStop[] = matchResult.newStops!.map(stop => {
          if (!stop.bookingId) {
            return { ...stop, bookingId };
          }
          return stop;
        });

        trip = {
          ...existingTrip,
          stops: updatedStops,
          routePolyline: matchResult.routePolyline!,
        };

        booking.tripId = existingTrip.id;

        setState(prev => ({
          ...prev,
          bookings: [...prev.bookings, booking],
          trips: prev.trips.map(t => (t.id === trip.id ? trip : t)),
          debugLog: [
            ...prev.debugLog,
            {
              id: generateLogId(),
              timestamp: new Date().toISOString(),
              category: 'booking',
              action: 'booking_created',
              details: {
                bookingNumber,
                tripId: trip.id,
                type: 'pooled',
                vehicleId: trip.vehicleId,
              },
            },
          ],
        }));
      }

      return { booking, trip };
    },
    [state]
  );

  const cancelBooking = useCallback((bookingId: string) => {
    setState(prev => {
      const booking = prev.bookings.find(b => b.id === bookingId);
      if (!booking || booking.status === 'cancelled') {
        return prev;
      }

      const updatedBookings = prev.bookings.map(b =>
        b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
      );

      // Check if trip should be cancelled (all bookings cancelled)
      let updatedTrips = prev.trips;
      if (booking.tripId) {
        const tripBookings = updatedBookings.filter(b => b.tripId === booking.tripId);
        const allCancelled = tripBookings.every(b => b.status === 'cancelled');

        if (allCancelled) {
          updatedTrips = prev.trips.map(t =>
            t.id === booking.tripId ? { ...t, status: 'cancelled' as const } : t
          );
        } else {
          // Remove stops for this booking from the trip
          updatedTrips = prev.trips.map(t => {
            if (t.id === booking.tripId) {
              const filteredStops = t.stops
                .filter(s => s.bookingId !== bookingId)
                .map((s, i) => ({ ...s, sequence: i }));
              return { ...t, stops: filteredStops };
            }
            return t;
          });
        }
      }

      return {
        ...prev,
        bookings: updatedBookings,
        trips: updatedTrips,
        debugLog: [
          ...prev.debugLog,
          {
            id: generateLogId(),
            timestamp: new Date().toISOString(),
            category: 'booking',
            action: 'booking_cancelled',
            details: {
              bookingNumber: booking.bookingNumber,
              tripId: booking.tripId,
            },
          },
        ],
      };
    });
  }, []);

  // Trip management
  const startTrip = useCallback((tripId: string) => {
    setState(prev => ({
      ...prev,
      trips: prev.trips.map(t =>
        t.id === tripId ? { ...t, status: 'in_progress' as const } : t
      ),
      debugLog: [
        ...prev.debugLog,
        {
          id: generateLogId(),
          timestamp: new Date().toISOString(),
          category: 'trip',
          action: 'trip_started',
          details: { tripId },
        },
      ],
    }));
  }, []);

  const completeTrip = useCallback((tripId: string) => {
    setState(prev => {
      const trip = prev.trips.find(t => t.id === tripId);

      // Update vehicle location to last dropoff
      let updatedVehicles = prev.vehicles;
      if (trip && trip.stops.length > 0) {
        const lastStop = trip.stops[trip.stops.length - 1];
        updatedVehicles = prev.vehicles.map(v =>
          v.id === trip.vehicleId ? { ...v, currentLocation: lastStop.location } : v
        );
      }

      return {
        ...prev,
        vehicles: updatedVehicles,
        trips: prev.trips.map(t =>
          t.id === tripId ? { ...t, status: 'completed' as const } : t
        ),
        debugLog: [
          ...prev.debugLog,
          {
            id: generateLogId(),
            timestamp: new Date().toISOString(),
            category: 'trip',
            action: 'trip_completed',
            details: { tripId },
          },
        ],
      };
    });
  }, []);

  // Time simulation
  const setSimulatedTime = useCallback((time: string | null) => {
    setState(prev => ({ ...prev, simulatedTime: time }));
  }, []);

  // Debug log management
  const clearDebugLog = useCallback(() => {
    setState(prev => ({ ...prev, debugLog: [] }));
  }, []);

  const setDebugLog = useCallback((log: DebugLogEntry[]) => {
    setState(prev => ({ ...prev, debugLog: log }));
  }, []);

  // Reset all data
  const resetAllData = useCallback(() => {
    clearAllData();
    setState(getDefaultState());
  }, []);

  return {
    state,
    updateConfig,
    createBooking,
    cancelBooking,
    startTrip,
    completeTrip,
    setSimulatedTime,
    clearDebugLog,
    setDebugLog,
    resetAllData,
    addLogEntry,
  };
}
