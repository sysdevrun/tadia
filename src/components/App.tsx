import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { MapView } from './MapView';
import { BookingModal } from './BookingModal';
import { ConfigPanel } from './ConfigPanel';
import { DebugPanel } from './DebugPanel';
import { TripPanel } from './TripPanel';

export function App() {
  const {
    state,
    updateConfig,
    createBooking,
    cancelBooking,
    startTrip,
    completeTrip,
    setSimulatedTime,
    clearDebugLog,
    resetAllData,
    addLogEntry,
  } = useAppState();

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [isTripPanelExpanded, setIsTripPanelExpanded] = useState(true);

  const hasApiKey = Boolean(state.config.googleMapsApiKey);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-xl font-semibold text-gray-800">Transport POC</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfigPanelOpen(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Config
          </button>
          <button
            onClick={() => setIsDebugPanelOpen(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Debug
          </button>
        </div>
      </header>

      {/* API Key Warning */}
      {!hasApiKey && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <span className="text-yellow-800 text-sm">
            Google Maps API key not configured. Please add your API key in Config.
          </span>
          <button
            onClick={() => setIsConfigPanelOpen(true)}
            className="text-yellow-800 text-sm font-medium underline hover:no-underline"
          >
            Configure now
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map */}
        <MapView
          apiKey={state.config.googleMapsApiKey}
          vehicles={state.vehicles}
          trips={state.trips}
          bookings={state.bookings}
          addLogEntry={addLogEntry}
        />

        {/* Trip Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white shadow-lg transition-transform duration-300 ${
            isTripPanelExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-40px)]'
          }`}
        >
          <button
            onClick={() => setIsTripPanelExpanded(!isTripPanelExpanded)}
            className="w-full h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-b border-gray-200"
          >
            <span className="text-gray-600 text-sm font-medium">
              {isTripPanelExpanded ? 'Hide' : 'Show'} Trips
            </span>
            <svg
              className={`ml-2 w-4 h-4 text-gray-500 transition-transform ${
                isTripPanelExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <div className="max-h-64 overflow-y-auto">
            <TripPanel
              vehicles={state.vehicles}
              trips={state.trips}
              bookings={state.bookings}
              onStartTrip={startTrip}
              onCompleteTrip={completeTrip}
              onCancelBooking={cancelBooking}
            />
          </div>
        </div>

        {/* FAB Button */}
        <button
          onClick={() => setIsBookingModalOpen(true)}
          disabled={!hasApiKey}
          className={`absolute bottom-72 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors ${
            hasApiKey
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={hasApiKey ? 'New Booking' : 'Configure API key first'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {isBookingModalOpen && (
        <BookingModal
          config={state.config}
          simulatedTime={state.simulatedTime}
          onClose={() => setIsBookingModalOpen(false)}
          onCreateBooking={createBooking}
          addLogEntry={addLogEntry}
        />
      )}

      {isConfigPanelOpen && (
        <ConfigPanel
          config={state.config}
          onUpdateConfig={updateConfig}
          onResetAllData={resetAllData}
          onClose={() => setIsConfigPanelOpen(false)}
        />
      )}

      {isDebugPanelOpen && (
        <DebugPanel
          debugLog={state.debugLog}
          simulatedTime={state.simulatedTime}
          onSetSimulatedTime={setSimulatedTime}
          onClearLog={clearDebugLog}
          onClose={() => setIsDebugPanelOpen(false)}
        />
      )}
    </div>
  );
}
