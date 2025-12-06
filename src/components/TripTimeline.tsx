import type { Trip, Booking } from '../types';
import { formatTime } from '../utils/timeUtils';

interface TripTimelineProps {
  trip: Trip;
  bookings: Booking[];
  vehicleColor: string;
  onStartTrip: (tripId: string) => void;
  onCompleteTrip: (tripId: string) => void;
  onCancelBooking: (bookingId: string) => void;
}

export function TripTimeline({
  trip,
  bookings,
  vehicleColor,
  onStartTrip,
  onCompleteTrip,
  onCancelBooking,
}: TripTimelineProps) {
  const sortedStops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">{trip.id}</span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${
              trip.status === 'in_progress'
                ? 'bg-green-100 text-green-700'
                : trip.status === 'planned'
                ? 'bg-blue-100 text-blue-700'
                : trip.status === 'completed'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {trip.status === 'in_progress' ? 'In Progress' : trip.status}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {trip.status === 'planned' && (
            <button
              onClick={() => onStartTrip(trip.id)}
              className="px-2 py-1 text-xs font-medium text-white rounded transition-colors"
              style={{ backgroundColor: vehicleColor }}
            >
              Start Trip
            </button>
          )}
          {trip.status === 'in_progress' && (
            <button
              onClick={() => onCompleteTrip(trip.id)}
              className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              Complete Trip
            </button>
          )}
        </div>
      </div>

      {/* Departure Time */}
      {trip.status === 'planned' && (
        <p className="text-xs text-gray-500 mb-2">
          Departs: {formatTime(trip.departureTime)}
        </p>
      )}

      {/* Timeline */}
      <div className="relative pl-4">
        {/* Vertical Line */}
        <div
          className="absolute left-1 top-2 bottom-2 w-0.5"
          style={{ backgroundColor: vehicleColor + '40' }}
        />

        {/* Stops */}
        <div className="space-y-2">
          {sortedStops.map((stop) => {
            const booking = bookings.find(b => b.id === stop.bookingId);
            if (!booking || booking.status === 'cancelled') return null;

            return (
              <div key={stop.id} className="relative flex items-start gap-3">
                {/* Dot */}
                <div
                  className={`absolute -left-3 w-2 h-2 rounded-full mt-1.5 ${
                    stop.type === 'pickup' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      {formatTime(stop.scheduledTime)}
                    </span>
                    <span className={`text-xs ${stop.type === 'pickup' ? 'text-green-600' : 'text-red-600'}`}>
                      {stop.type === 'pickup' ? 'Pickup' : 'Dropoff'}
                    </span>
                    <span className="text-xs text-gray-600">
                      - {booking.bookingNumber} ({booking.passengerCount} pax)
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{stop.address}</p>
                </div>

                {/* Cancel Button (only for planned trips and pickup stops) */}
                {trip.status === 'planned' && stop.type === 'pickup' && (
                  <button
                    onClick={() => onCancelBooking(booking.id)}
                    className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Cancel booking"
                  >
                    Cancel
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
