import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initGoogleMaps,
  isGoogleMapsLoaded,
  setLogCallback,
  getRoute,
  reverseGeocode,
  getPlacePredictions,
  getPlaceDetails,
  decodePolyline,
} from '../services/googleMapsService';
import type { DebugLogEntry } from '../types';
import { LA_REUNION_CENTER, DEFAULT_ZOOM } from '../constants';

export function useGoogleMaps(
  apiKey: string,
  addLogEntry: (entry: DebugLogEntry) => void
) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    setLogCallback(addLogEntry);
  }, [addLogEntry]);

  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key not configured');
      return;
    }

    if (isGoogleMapsLoaded()) {
      setIsLoaded(true);
      return;
    }

    initGoogleMaps(apiKey)
      .then((success) => {
        setIsLoaded(success);
        if (!success) {
          setError('Failed to load Google Maps');
        }
      })
      .catch((err) => {
        setError(String(err));
      });
  }, [apiKey]);

  const initializeMap = useCallback(
    (element: HTMLElement): google.maps.Map | null => {
      if (!isLoaded) return null;

      const map = new google.maps.Map(element, {
        center: LA_REUNION_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapRef.current = map;
      return map;
    },
    [isLoaded]
  );

  const getMap = useCallback(() => mapRef.current, []);

  return {
    isLoaded,
    error,
    initializeMap,
    getMap,
    getRoute,
    reverseGeocode,
    getPlacePredictions,
    getPlaceDetails: (placeId: string) =>
      mapRef.current ? getPlaceDetails(placeId, mapRef.current) : Promise.resolve(null),
    decodePolyline,
  };
}
