import { useState } from 'react';
import type { AppConfig, Coordinates, Booking, Trip, DebugLogEntry, BookingRequest } from '../../types';
import { StepPickup } from './StepPickup';
import { StepDropoff } from './StepDropoff';
import { StepTime } from './StepTime';
import { StepConfirm } from './StepConfirm';

interface BookingModalProps {
  config: AppConfig;
  simulatedTime: string | null;
  onClose: () => void;
  onCreateBooking: (request: BookingRequest) => Promise<{ booking: Booking; trip: Trip } | { error: string }>;
  addLogEntry: (entry: DebugLogEntry) => void;
}

interface BookingData {
  pickupLocation: Coordinates | null;
  pickupAddress: string;
  dropoffLocation: Coordinates | null;
  dropoffAddress: string;
  pickupTime: string;
  passengerCount: number;
}

type Step = 'pickup' | 'dropoff' | 'time' | 'confirm';

export function BookingModal({
  config,
  simulatedTime,
  onClose,
  onCreateBooking,
  addLogEntry,
}: BookingModalProps) {
  const [step, setStep] = useState<Step>('pickup');
  const [bookingData, setBookingData] = useState<BookingData>({
    pickupLocation: null,
    pickupAddress: '',
    dropoffLocation: null,
    dropoffAddress: '',
    pickupTime: '',
    passengerCount: 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ booking: Booking; trip: Trip } | { error: string } | null>(null);

  const handlePickupComplete = (location: Coordinates, address: string) => {
    setBookingData(prev => ({ ...prev, pickupLocation: location, pickupAddress: address }));
    setStep('dropoff');
  };

  const handleDropoffComplete = (location: Coordinates, address: string) => {
    setBookingData(prev => ({ ...prev, dropoffLocation: location, dropoffAddress: address }));
    setStep('time');
  };

  const handleTimeComplete = (pickupTime: string, passengerCount: number) => {
    setBookingData(prev => ({ ...prev, pickupTime, passengerCount }));
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!bookingData.pickupLocation || !bookingData.dropoffLocation || !bookingData.pickupTime) {
      return;
    }

    setIsLoading(true);
    try {
      const request: BookingRequest = {
        pickupLocation: bookingData.pickupLocation,
        pickupAddress: bookingData.pickupAddress,
        dropoffLocation: bookingData.dropoffLocation,
        dropoffAddress: bookingData.dropoffAddress,
        requestedPickupTime: bookingData.pickupTime,
        passengerCount: bookingData.passengerCount,
      };

      const bookingResult = await onCreateBooking(request);
      setResult(bookingResult);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryDifferentTime = () => {
    setResult(null);
    setStep('time');
  };

  const stepNumber = step === 'pickup' ? 1 : step === 'dropoff' ? 2 : step === 'time' ? 3 : 4;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">New Booking</h2>
            <p className="text-sm text-gray-500">Step {stepNumber} of 4</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(stepNumber / 4) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {step === 'pickup' && (
            <StepPickup
              apiKey={config.googleMapsApiKey}
              onComplete={handlePickupComplete}
              onCancel={onClose}
              addLogEntry={addLogEntry}
            />
          )}

          {step === 'dropoff' && (
            <StepDropoff
              apiKey={config.googleMapsApiKey}
              pickupLocation={bookingData.pickupLocation!}
              pickupAddress={bookingData.pickupAddress}
              onComplete={handleDropoffComplete}
              onBack={() => setStep('pickup')}
              addLogEntry={addLogEntry}
            />
          )}

          {step === 'time' && (
            <StepTime
              config={config}
              simulatedTime={simulatedTime}
              onComplete={handleTimeComplete}
              onBack={() => setStep('dropoff')}
            />
          )}

          {step === 'confirm' && (
            <StepConfirm
              bookingData={bookingData}
              result={result}
              isLoading={isLoading}
              onConfirm={handleConfirm}
              onTryDifferentTime={handleTryDifferentTime}
              onClose={onClose}
              onBack={() => setStep('time')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
