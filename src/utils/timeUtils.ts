export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function addMinutes(date: Date | string, minutes: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(d.getTime() + minutes * 60 * 1000);
}

export function addSeconds(date: Date | string, seconds: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(d.getTime() + seconds * 1000);
}

export function differenceInMinutes(later: Date | string, earlier: Date | string): number {
  const l = typeof later === 'string' ? new Date(later) : later;
  const e = typeof earlier === 'string' ? new Date(earlier) : earlier;
  return (l.getTime() - e.getTime()) / (60 * 1000);
}

export function differenceInSeconds(later: Date | string, earlier: Date | string): number {
  const l = typeof later === 'string' ? new Date(later) : later;
  const e = typeof earlier === 'string' ? new Date(earlier) : earlier;
  return (l.getTime() - e.getTime()) / 1000;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

// Generate time slots from 00:00 to 23:45 in 15-minute intervals
export function getAllTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = String(hour).padStart(2, '0');
      const m = String(minute).padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
}

// Fixed date for all bookings (2027-01-01)
export const BOOKING_DATE = new Date(2027, 0, 1); // January 1, 2027

// Convert time string (HH:MM) to Date using fixed date 2027-01-01
export function timeStringToDate(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(2027, 0, 1); // January 1, 2027
  date.setHours(hours, minutes, 0, 0);
  return date;
}
