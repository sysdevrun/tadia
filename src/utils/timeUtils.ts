import type { AppConfig } from '../types';

export function getCurrentTime(simulatedTime: string | null): Date {
  return simulatedTime ? new Date(simulatedTime) : new Date();
}

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

export function isWithinServiceHours(time: Date | string, config: AppConfig): boolean {
  const d = typeof time === 'string' ? new Date(time) : time;
  const hour = d.getHours();

  // Service runs 20:00 to 05:00 (next day)
  if (config.serviceStartHour > config.serviceEndHour) {
    // Overnight service
    return hour >= config.serviceStartHour || hour < config.serviceEndHour;
  }
  return hour >= config.serviceStartHour && hour < config.serviceEndHour;
}

export function getValidPickupTimes(simulatedTime: string | null, config: AppConfig): Date[] {
  const now = getCurrentTime(simulatedTime);
  const minTime = addMinutes(now, config.minBookingAdvanceMinutes);
  const times: Date[] = [];

  // Generate time slots in 15-minute intervals
  const currentDate = new Date(minTime);
  currentDate.setMinutes(Math.ceil(currentDate.getMinutes() / 15) * 15, 0, 0);

  // Get end of service (05:00 next day if currently after 20:00, or 05:00 today)
  const endOfService = new Date(now);
  if (now.getHours() >= config.serviceStartHour) {
    // After 20:00, service ends at 05:00 next day
    endOfService.setDate(endOfService.getDate() + 1);
  }
  endOfService.setHours(config.serviceEndHour, 0, 0, 0);

  // Also check if we're before 05:00 (early morning), service is still running
  const startOfService = new Date(now);
  if (now.getHours() < config.serviceEndHour) {
    // It's early morning, service started yesterday at 20:00
    startOfService.setDate(startOfService.getDate() - 1);
  }
  startOfService.setHours(config.serviceStartHour, 0, 0, 0);

  while (currentDate < endOfService && times.length < 48) {
    if (isWithinServiceHours(currentDate, config)) {
      times.push(new Date(currentDate));
    }
    currentDate.setMinutes(currentDate.getMinutes() + 15);
  }

  return times;
}

export function isValidPickupTime(time: Date | string, simulatedTime: string | null, config: AppConfig): boolean {
  const t = typeof time === 'string' ? new Date(time) : time;
  const now = getCurrentTime(simulatedTime);
  const minTime = addMinutes(now, config.minBookingAdvanceMinutes);

  return t >= minTime && isWithinServiceHours(t, config);
}
