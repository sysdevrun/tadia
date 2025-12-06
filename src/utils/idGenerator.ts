let bookingCounter = 0;
let tripCounter = 0;
let stopCounter = 0;
let logCounter = 0;

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateBookingNumber(): string {
  bookingCounter++;
  return `BK-${String(bookingCounter).padStart(3, '0')}`;
}

export function generateTripId(): string {
  tripCounter++;
  return `TRP-${String(tripCounter).padStart(3, '0')}`;
}

export function generateStopId(): string {
  stopCounter++;
  return `STP-${String(stopCounter).padStart(4, '0')}`;
}

export function generateLogId(): string {
  logCounter++;
  return `LOG-${String(logCounter).padStart(5, '0')}`;
}

export function initializeCounters(bookings: number, trips: number, stops: number, logs: number): void {
  bookingCounter = bookings;
  tripCounter = trips;
  stopCounter = stops;
  logCounter = logs;
}
