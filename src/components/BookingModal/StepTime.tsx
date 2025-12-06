import { useState, useMemo } from 'react';
import type { AppConfig } from '../../types';
import { getAllTimeSlots, timeStringToDate } from '../../utils/timeUtils';

interface StepTimeProps {
  config: AppConfig;
  onComplete: (pickupTime: string, passengerCount: number) => void;
  onBack: () => void;
}

export function StepTime({ config, onComplete, onBack }: StepTimeProps) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);

  const timeSlots = useMemo(() => getAllTimeSlots(), []);

  const handleNext = () => {
    if (selectedTime) {
      const pickupDate = timeStringToDate(selectedTime);
      onComplete(pickupDate.toISOString(), passengerCount);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Select Time & Passengers</h3>

      {/* Time Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
        <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1 border border-gray-200 rounded-md">
          {timeSlots.map((time) => (
            <button
              key={time}
              onClick={() => setSelectedTime(time)}
              className={`px-2 py-1.5 text-sm rounded transition-colors ${
                selectedTime === time
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-blue-50'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
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
      {selectedTime && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            <strong>Summary:</strong> {passengerCount} passenger{passengerCount > 1 ? 's' : ''} at{' '}
            {selectedTime}
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
          disabled={!selectedTime}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          Search
        </button>
      </div>
    </div>
  );
}
