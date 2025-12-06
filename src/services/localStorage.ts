import type { AppState, AppConfig } from '../types';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_VEHICLES } from '../constants';
import { initializeCounters } from '../utils/idGenerator';

export function getDefaultState(): AppState {
  return {
    vehicles: DEFAULT_VEHICLES.slice(0, DEFAULT_CONFIG.vehicleCount),
    bookings: [],
    trips: [],
    debugLog: [],
    config: DEFAULT_CONFIG,
  };
}

export function loadState(): AppState {
  try {
    const stateJson = localStorage.getItem(STORAGE_KEYS.STATE);
    if (stateJson) {
      const state = JSON.parse(stateJson) as AppState;

      // Initialize counters based on existing data
      const maxBookingNum = state.bookings.reduce((max, b) => {
        const num = parseInt(b.bookingNumber.replace('BK-', ''), 10);
        return Math.max(max, isNaN(num) ? 0 : num);
      }, 0);

      const maxTripNum = state.trips.reduce((max, t) => {
        const num = parseInt(t.id.replace('TRP-', ''), 10);
        return Math.max(max, isNaN(num) ? 0 : num);
      }, 0);

      const maxStopNum = state.trips.reduce((max, t) => {
        return t.stops.reduce((stopMax, s) => {
          const num = parseInt(s.id.replace('STP-', ''), 10);
          return Math.max(stopMax, isNaN(num) ? 0 : num);
        }, max);
      }, 0);

      const logNum = state.debugLog.length;

      initializeCounters(maxBookingNum, maxTripNum, maxStopNum, logNum);

      return state;
    }
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
  }

  return getDefaultState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
    // Could be quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // Try to trim debug log and retry
      const trimmedState = {
        ...state,
        debugLog: state.debugLog.slice(-500), // Keep last 500 entries
      };
      try {
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(trimmedState));
      } catch {
        console.error('Failed to save even trimmed state');
      }
    }
  }
}

export function loadConfig(): AppConfig {
  try {
    const configJson = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (configJson) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(configJson) };
    }
  } catch (error) {
    console.error('Failed to load config from localStorage:', error);
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: AppConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save config to localStorage:', error);
  }
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.STATE);
  localStorage.removeItem(STORAGE_KEYS.CONFIG);
  initializeCounters(0, 0, 0, 0);
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): AppState | null {
  try {
    const state = JSON.parse(json) as AppState;
    // Basic validation
    if (!state.vehicles || !state.bookings || !state.trips || !state.config) {
      throw new Error('Invalid state structure');
    }
    return state;
  } catch (error) {
    console.error('Failed to import state:', error);
    return null;
  }
}
