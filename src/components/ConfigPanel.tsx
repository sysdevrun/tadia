import { useState } from 'react';
import type { AppConfig } from '../types';

interface ConfigPanelProps {
  config: AppConfig;
  onUpdateConfig: (updates: Partial<AppConfig>) => void;
  onResetAllData: () => void;
  onClose: () => void;
}

export function ConfigPanel({ config, onUpdateConfig, onResetAllData, onClose }: ConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleChange = (key: keyof AppConfig, value: string | number) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onUpdateConfig(localConfig);
    onClose();
  };

  const handleReset = () => {
    onResetAllData();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Configuration</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Maps API Key
            </label>
            <input
              type="password"
              value={localConfig.googleMapsApiKey}
              onChange={(e) => handleChange('googleMapsApiKey', e.target.value)}
              placeholder="Enter your API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Required for map display and route calculation
            </p>
          </div>

          {/* Vehicle Settings */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Vehicle Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Number of Vehicles</label>
                <select
                  value={localConfig.vehicleCount}
                  onChange={(e) => handleChange('vehicleCount', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[1, 2, 3].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Seats per Vehicle</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={localConfig.seatsPerVehicle}
                  onChange={(e) => handleChange('seatsPerVehicle', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Pooling Settings */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Pooling Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Max Detour (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={localConfig.maxDetourMinutes}
                  onChange={(e) => handleChange('maxDetourMinutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Minutes per Stop</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={localConfig.minutesPerStop}
                  onChange={(e) => handleChange('minutesPerStop', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Buffer Time (minutes)</label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={localConfig.bufferMinutes}
                  onChange={(e) => handleChange('bufferMinutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Time between arrival and pickup
                </p>
              </div>
            </div>
          </div>

          {/* Reset Data */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Data Management</h3>

            {showResetConfirm ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800 mb-3">
                  This will delete all bookings, trips, and debug logs. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                  >
                    Yes, Reset All Data
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
              >
                Reset All Data
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
