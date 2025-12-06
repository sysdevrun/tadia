import type { Coordinates, Booking, Trip } from '../../types';
import { formatTime } from '../../utils/timeUtils';

interface BookingData {
  pickupLocation: Coordinates | null;
  pickupAddress: string;
  dropoffLocation: Coordinates | null;
  dropoffAddress: string;
  pickupTime: string;
  passengerCount: number;
}

interface StepConfirmProps {
  bookingData: BookingData;
  result: { booking: Booking; trip: Trip } | { error: string } | null;
  isLoading: boolean;
  onConfirm: () => void;
  onTryDifferentTime: () => void;
  onClose: () => void;
  onBack: () => void;
}

export function StepConfirm({
  bookingData,
  result,
  isLoading,
  onConfirm,
  onTryDifferentTime,
  onClose,
  onBack,
}: StepConfirmProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600">Searching for available trips...</p>
      </div>
    );
  }

  // Error result
  if (result && 'error' in result) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">❌</div>
          <h4 className="font-medium text-red-800 mb-1">Booking Not Available</h4>
          <p className="text-sm text-red-600">{result.error}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <h5 className="font-medium text-gray-700 mb-2">Requested Trip</h5>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Pickup:</strong> {bookingData.pickupAddress}</p>
            <p><strong>Dropoff:</strong> {bookingData.dropoffAddress}</p>
            <p><strong>Time:</strong> {formatTime(bookingData.pickupTime)}</p>
            <p><strong>Passengers:</strong> {bookingData.passengerCount}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Close
          </button>
          <button
            onClick={onTryDifferentTime}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Try Different Time
          </button>
        </div>
      </div>
    );
  }

  // Success result
  if (result && 'booking' in result) {
    const { booking, trip } = result;
    const isPooled = trip.stops.length > 2; // More than just this booking's pickup/dropoff

    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">✅</div>
          <h4 className="font-medium text-green-800 mb-1">Booking Confirmed!</h4>
          <p className="text-2xl font-bold text-green-700">{booking.bookingNumber}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              isPooled ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isPooled ? 'Pooled Trip' : 'New Trip'}
            </span>
            <span className="text-xs text-gray-500">Trip #{trip.id}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Pickup Time</p>
              <p className="font-medium text-gray-800">{formatTime(booking.estimatedPickupTime)}</p>
            </div>
            <div>
              <p className="text-gray-500">Est. Dropoff</p>
              <p className="font-medium text-gray-800">{formatTime(booking.estimatedDropoffTime)}</p>
            </div>
          </div>

          <div className="text-sm">
            <div className="flex items-start gap-2 mb-2">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Pickup</p>
                <p className="text-gray-800">{booking.pickupAddress}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-red-500 flex-shrink-0" />
              <div>
                <p className="text-gray-500">Dropoff</p>
                <p className="text-gray-800">{booking.dropoffAddress}</p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 pt-2 border-t border-gray-200">
            <p><strong>Passengers:</strong> {booking.passengerCount}</p>
            <p><strong>Vehicle:</strong> {trip.vehicleId}</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Initial confirmation state (before search)
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Confirm Your Booking</h3>

      <div className="bg-gray-50 rounded-lg p-3 space-y-3">
        <div className="text-sm">
          <div className="flex items-start gap-2 mb-2">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-green-500 flex-shrink-0" />
            <div>
              <p className="text-gray-500">Pickup</p>
              <p className="text-gray-800">{bookingData.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <div>
              <p className="text-gray-500">Dropoff</p>
              <p className="text-gray-800">{bookingData.dropoffAddress}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-gray-200">
          <div>
            <p className="text-gray-500">Pickup Time</p>
            <p className="font-medium text-gray-800">{formatTime(bookingData.pickupTime)}</p>
          </div>
          <div>
            <p className="text-gray-500">Passengers</p>
            <p className="font-medium text-gray-800">{bookingData.passengerCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-sm text-blue-800">
          Click "Confirm" to search for available trips and complete your booking.
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          Confirm Booking
        </button>
      </div>
    </div>
  );
}
