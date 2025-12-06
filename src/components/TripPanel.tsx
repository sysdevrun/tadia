import { useState } from 'react';
import type { Vehicle, Trip, Booking } from '../types';
import { VehicleCard } from './VehicleCard';
import { TripTimeline } from './TripTimeline';

interface TripPanelProps {
  vehicles: Vehicle[];
  trips: Trip[];
  bookings: Booking[];
  onStartTrip: (tripId: string) => void;
  onCompleteTrip: (tripId: string) => void;
  onCancelBooking: (bookingId: string) => void;
}

export function TripPanel({
  vehicles,
  trips,
  bookings,
  onStartTrip,
  onCompleteTrip,
  onCancelBooking,
}: TripPanelProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const vehicleTrips = selectedVehicleId
    ? trips.filter(t => t.vehicleId === selectedVehicleId && t.status !== 'cancelled')
    : [];

  return (
    <div className="p-4">
      {/* Vehicle Cards */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {vehicles.map(vehicle => {
          const vTrips = trips.filter(t => t.vehicleId === vehicle.id && t.status !== 'cancelled');
          const activeTrip = vTrips.find(t => t.status === 'in_progress' || t.status === 'planned');
          const tripBookings = activeTrip
            ? bookings.filter(b => b.tripId === activeTrip.id && b.status === 'confirmed')
            : [];
          const totalPassengers = tripBookings.reduce((sum, b) => sum + b.passengerCount, 0);

          return (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              trip={activeTrip}
              passengerCount={totalPassengers}
              isSelected={selectedVehicleId === vehicle.id}
              onClick={() => setSelectedVehicleId(
                selectedVehicleId === vehicle.id ? null : vehicle.id
              )}
            />
          );
        })}
      </div>

      {/* Trip Timeline */}
      {selectedVehicle && vehicleTrips.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-800 mb-3" style={{ color: selectedVehicle.color }}>
            {selectedVehicle.name} Trips
          </h3>
          <div className="space-y-4">
            {vehicleTrips.map(trip => (
              <TripTimeline
                key={trip.id}
                trip={trip}
                bookings={bookings.filter(b => b.tripId === trip.id)}
                vehicleColor={selectedVehicle.color}
                onStartTrip={onStartTrip}
                onCompleteTrip={onCompleteTrip}
                onCancelBooking={onCancelBooking}
              />
            ))}
          </div>
        </div>
      )}

      {selectedVehicle && vehicleTrips.length === 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-500 text-center py-4">
            No active trips for {selectedVehicle.name}
          </p>
        </div>
      )}

      {!selectedVehicle && (
        <div className="mt-4 text-center py-4">
          <p className="text-sm text-gray-500">
            Select a vehicle to view its trips
          </p>
        </div>
      )}
    </div>
  );
}
