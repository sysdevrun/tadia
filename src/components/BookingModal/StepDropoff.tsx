import { useState, useEffect, useRef } from 'react';
import type { Coordinates, DebugLogEntry } from '../../types';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { LA_REUNION_CENTER } from '../../constants';

interface StepDropoffProps {
  apiKey: string;
  pickupLocation: Coordinates;
  pickupAddress: string;
  onComplete: (location: Coordinates, address: string) => void;
  onBack: () => void;
  addLogEntry: (entry: DebugLogEntry) => void;
}

export function StepDropoff({
  apiKey,
  pickupLocation,
  pickupAddress,
  onComplete,
  onBack,
  addLogEntry,
}: StepDropoffProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ description: string; placeId: string }[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const { isLoaded, reverseGeocode, getPlacePredictions, getPlaceDetails } = useGoogleMaps(apiKey, addLogEntry);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: pickupLocation,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mapRef.current = map;

    // Add pickup marker (non-editable)
    pickupMarkerRef.current = new google.maps.Marker({
      position: { lat: pickupLocation.lat, lng: pickupLocation.lng },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#22C55E',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 8,
      },
      title: 'Pickup: ' + pickupAddress,
    });

    // Add click listener for dropoff
    map.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const location: Coordinates = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        };
        setSelectedLocation(location);
        setIsLoadingAddress(true);

        // Update marker
        if (dropoffMarkerRef.current) {
          dropoffMarkerRef.current.setPosition(e.latLng);
        } else {
          dropoffMarkerRef.current = new google.maps.Marker({
            position: e.latLng,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#EF4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 10,
            },
          });
        }

        // Reverse geocode
        const addr = await reverseGeocode(location);
        setAddress(addr);
        setSearchQuery(addr);
        setIsLoadingAddress(false);
      }
    });
  }, [isLoaded, pickupLocation, pickupAddress, reverseGeocode]);

  // Handle search input
  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);

    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    const predictions = await getPlacePredictions(value, LA_REUNION_CENTER);
    setSuggestions(predictions);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (placeId: string, description: string) => {
    setSuggestions([]);
    setSearchQuery(description);
    setIsLoadingAddress(true);

    const location = await getPlaceDetails(placeId);

    if (location && mapRef.current) {
      setSelectedLocation(location);
      setAddress(description);
      setIsLoadingAddress(false);

      // Update map and marker
      mapRef.current.panTo({ lat: location.lat, lng: location.lng });
      mapRef.current.setZoom(15);

      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setPosition({ lat: location.lat, lng: location.lng });
      } else {
        dropoffMarkerRef.current = new google.maps.Marker({
          position: { lat: location.lat, lng: location.lng },
          map: mapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 10,
          },
        });
      }
    } else {
      setIsLoadingAddress(false);
    }
  };

  const handleNext = () => {
    if (selectedLocation && address) {
      onComplete(selectedLocation, address);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Select Dropoff Location</h3>
      <p className="text-sm text-gray-500">Click on the map or search for an address</p>

      {/* Pickup Info */}
      <div className="bg-green-50 border border-green-200 rounded-md p-2">
        <p className="text-xs font-medium text-green-800">Pickup</p>
        <p className="text-sm text-green-700 truncate">{pickupAddress}</p>
      </div>

      {/* Search Box */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search for an address..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.placeId}
                onClick={() => handleSelectSuggestion(suggestion.placeId, suggestion.description)}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
              >
                {suggestion.description}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div ref={mapContainerRef} className="w-full h-64 rounded-lg overflow-hidden border border-gray-300">
        {!isLoaded && (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Selected Location */}
      {selectedLocation && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm font-medium text-red-800">Selected Dropoff</p>
          {isLoadingAddress ? (
            <p className="text-sm text-red-600">Loading address...</p>
          ) : (
            <p className="text-sm text-red-700">{address}</p>
          )}
          <p className="text-xs text-red-600 mt-1">
            {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!selectedLocation || !address || isLoadingAddress}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
