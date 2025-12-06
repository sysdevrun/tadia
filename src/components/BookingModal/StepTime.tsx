import { useState, useMemo } from 'react';
import type { AppConfig } from '../../types';
import { getValidPickupTimes, formatTime } from '../../utils/timeUtils';

interface StepTimeProps {
  config: AppConfig;
  simulatedTime: string | null;
  onComplete: (pickupTime: string, passengerCount: number) => void;
  onBack: () => void;
}

export function StepTime({ config, simulatedTime, onComplete, onBack }: StepTimeProps) {
  const [selectedTimeIndex, setSelectedTimeIndex] = useState<number | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);

  const validTimes = useMemo(() => getValidPickupTimes(simulatedTime, config), [simulatedTime, config]);

  const handleNext = () => {
    if (selectedTimeIndex !== null && validTimes[selectedTimeIndex]) {
      onComplete(validTimes[selectedTimeIndex].toISOString(), passengerCount);
    }
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Select Time & Passengers</h3>

      {/* Date (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
          {today}
        </div>
        <p className="text-xs text-gray-500 mt-1">POC only supports same-day bookings</p>
      </div>

      {/* Time Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
        {validTimes.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
            {validTimes.map((time, index) => (
              <button
                key={time.toISOString()}
                onClick={() => setSelectedTimeIndex(index)}
                className={`px-2 py-2 text-sm rounded-md border transition-colors ${
                  selectedTimeIndex === index
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                }`}
              >
                {formatTime(time)}
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              No available time slots. Service hours are {config.serviceStartHour}:00 to {config.serviceEndHour}:00.
              Bookings must be made at least {config.minBookingAdvanceMinutes} minutes in advance.
            </p>
          </div>
        )}
      </div>

      {/* Passenger Count */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Passengers</label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
            disabled={passengerCount <= 1}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            -
          </button>
          <span className="text-xl font-medium text-gray-800 w-8 text-center">{passengerCount}</span>
          <button
            onClick={() => setPassengerCount(Math.min(config.seatsPerVehicle, passengerCount + 1))}
            disabled={passengerCount >= config.seatsPerVehicle}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
          <span className="text-sm text-gray-500">Max {config.seatsPerVehicle} per vehicle</span>
        </div>
      </div>

      {/* Summary */}
      {selectedTimeIndex !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            <strong>Summary:</strong> {passengerCount} passenger{passengerCount > 1 ? 's' : ''} at{' '}
            {formatTime(validTimes[selectedTimeIndex])}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={selectedTimeIndex === null}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          Search
        </button>
      </div>
    </div>
  );
}
