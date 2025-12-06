import { useEffect, useRef, useState } from 'react';
import type { Vehicle, Trip, Booking, DebugLogEntry } from '../types';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { LA_REUNION_CENTER, DEFAULT_ZOOM } from '../constants';

interface MapViewProps {
  apiKey: string;
  vehicles: Vehicle[];
  trips: Trip[];
  bookings: Booking[];
  addLogEntry: (entry: DebugLogEntry) => void;
}

export function MapView({ apiKey, vehicles, trips, bookings, addLogEntry }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const { isLoaded, error, decodePolyline } = useGoogleMaps(apiKey, addLogEntry);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapInitialized) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: LA_REUNION_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mapRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();
    setMapInitialized(true);
  }, [isLoaded, mapInitialized]);

  // Update markers and polylines when trips/bookings change
  useEffect(() => {
    if (!mapRef.current || !mapInitialized) return;

    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => marker.setMap(null));
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    // Add trip routes
    const activeTrips = trips.filter(t => t.status === 'planned' || t.status === 'in_progress');

    for (const trip of activeTrips) {
      const vehicle = vehicles.find(v => v.id === trip.vehicleId);
      if (!vehicle || !trip.routePolyline) continue;

      // Decode and draw polyline
      const path = decodePolyline(trip.routePolyline);
      const polyline = new google.maps.Polyline({
        path: path.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: vehicle.color,
        strokeOpacity: trip.status === 'planned' ? 0.6 : 1,
        strokeWeight: 4,
        map,
      });

      if (trip.status === 'planned') {
        // Make it dashed for planned trips
        polyline.setOptions({
          icons: [
            {
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                scale: 3,
              },
              offset: '0',
              repeat: '15px',
            },
          ],
          strokeOpacity: 0,
        });
      }

      polylinesRef.current.push(polyline);

      // Add markers for stops
      for (const stop of trip.stops) {
        const booking = bookings.find(b => b.id === stop.bookingId);
        if (!booking || booking.status === 'cancelled') continue;

        const marker = new google.maps.Marker({
          position: { lat: stop.location.lat, lng: stop.location.lng },
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: stop.type === 'pickup' ? '#22C55E' : '#EF4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8,
          },
          title: `${stop.type === 'pickup' ? 'Pickup' : 'Dropoff'}: ${booking.bookingNumber}`,
        });

        marker.addListener('click', () => {
          if (infoWindow) {
            const scheduledTime = new Date(stop.scheduledTime).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            infoWindow.setContent(`
              <div style="padding: 8px; min-width: 150px;">
                <div style="font-weight: 600; margin-bottom: 4px;">
                  ${stop.type === 'pickup' ? 'Pickup' : 'Dropoff'}
                </div>
                <div style="font-size: 12px; color: #666;">
                  <div><strong>Booking:</strong> ${booking.bookingNumber}</div>
                  <div><strong>Time:</strong> ${scheduledTime}</div>
                  <div><strong>Passengers:</strong> ${booking.passengerCount}</div>
                  <div><strong>Address:</strong> ${stop.address}</div>
                </div>
              </div>
            `);
            infoWindow.open(map, marker);
          }
        });

        markersRef.current.push(marker);
      }

      // Add vehicle marker at first stop or current location
      if (vehicle.currentLocation || trip.stops.length > 0) {
        const position = vehicle.currentLocation || trip.stops[0].location;
        const vehicleMarker = new google.maps.Marker({
          position: { lat: position.lat, lng: position.lng },
          map,
          icon: {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: vehicle.color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1.5,
            anchor: new google.maps.Point(12, 22),
          },
          title: vehicle.name,
          zIndex: 1000,
        });

        vehicleMarker.addListener('click', () => {
          if (infoWindow) {
            const tripBookings = bookings.filter(b => b.tripId === trip.id && b.status === 'confirmed');
            const totalPassengers = tripBookings.reduce((sum, b) => sum + b.passengerCount, 0);

            infoWindow.setContent(`
              <div style="padding: 8px; min-width: 150px;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${vehicle.color};">
                  ${vehicle.name}
                </div>
                <div style="font-size: 12px; color: #666;">
                  <div><strong>Status:</strong> ${trip.status}</div>
                  <div><strong>Trip:</strong> ${trip.id}</div>
                  <div><strong>Passengers:</strong> ${totalPassengers}/${vehicle.capacity}</div>
                  <div><strong>Stops:</strong> ${trip.stops.length}</div>
                </div>
              </div>
            `);
            infoWindow.open(map, vehicleMarker);
          }
        });

        markersRef.current.push(vehicleMarker);
      }
    }
  }, [trips, bookings, vehicles, mapInitialized, decodePolyline]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <div className="text-center p-4 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-700 font-medium mb-2">Map unavailable</p>
          <p className="text-sm text-red-600 mb-4 break-words">{error}</p>
          <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded text-left">
            <p className="font-medium mb-1">Troubleshooting:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check if the API key is valid</li>
              <li>Ensure Maps JavaScript API is enabled in Google Cloud Console</li>
              <li>Check API key restrictions (HTTP referrers, etc.)</li>
              <li>Open Debug panel to see detailed error logs</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <div className="text-center p-4">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-gray-600 mb-2">Map Preview</p>
          <p className="text-sm text-gray-500">Configure your Google Maps API key to enable the map</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} className="w-full h-full">
      {!isLoaded && (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <div className="text-center p-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
