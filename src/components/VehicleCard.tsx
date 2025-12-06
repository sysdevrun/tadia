import type { Vehicle, Trip } from '../types';
import { formatTime } from '../utils/timeUtils';

interface VehicleCardProps {
  vehicle: Vehicle;
  trip: Trip | undefined;
  passengerCount: number;
  isSelected: boolean;
  onClick: () => void;
}

export function VehicleCard({ vehicle, trip, passengerCount, isSelected, onClick }: VehicleCardProps) {
  const getStatusText = () => {
    if (!trip) return 'Idle';
    if (trip.status === 'in_progress') return 'In Progress';
    if (trip.status === 'planned') return 'Planned';
    return trip.status;
  };

  const getNextStop = () => {
    if (!trip || trip.stops.length === 0) return null;
    // For simplicity, return the first stop
    const nextStop = trip.stops[0];
    return nextStop;
  };

  const nextStop = getNextStop();

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-64 p-3 rounded-lg border-2 text-left transition-colors ${
        isSelected
          ? 'border-current bg-opacity-10'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
      style={{
        borderColor: isSelected ? vehicle.color : undefined,
        backgroundColor: isSelected ? `${vehicle.color}10` : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: vehicle.color }}
        />
        <span className="font-medium text-gray-800">{vehicle.name}</span>
      </div>

      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Status:</span>
          <span
            className={`font-medium ${
              trip?.status === 'in_progress'
                ? 'text-green-600'
                : trip?.status === 'planned'
                ? 'text-blue-600'
                : 'text-gray-600'
            }`}
          >
            {getStatusText()}
          </span>
        </div>

        {trip && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Trip:</span>
              <span className="text-gray-700">{trip.id}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Passengers:</span>
              <span className="text-gray-700">{passengerCount}/{vehicle.capacity}</span>
            </div>
          </>
        )}

        {nextStop && (
          <div className="pt-1 border-t border-gray-100 mt-1">
            <div className="text-xs text-gray-500">Next stop:</div>
            <div className="text-xs text-gray-700 truncate">
              {nextStop.type === 'pickup' ? 'Pickup' : 'Dropoff'} at {nextStop.address.split(',')[0]}
            </div>
            <div className="text-xs text-gray-500">
              ETA: {formatTime(nextStop.scheduledTime)}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
