import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  DetectedLocation,
  NearbyDoctor,
  NearbyHospital,
} from '../types';
import { soundEffects } from '../utils/audio';
import { buildWhatsAppUrl, buildEmergencyWhatsAppMessage } from '../utils/whatsapp';
import { WhatsAppIcon } from './WhatsAppIcon';

interface LiveEmergencyMapProps {
  mapsApiKey: string;
  location: DetectedLocation;
  hospitals: NearbyHospital[];
  doctors: NearbyDoctor[];
  selectedHospitalId: string;
  crashDetected?: boolean;
  onSelectTargetHospital: (hosp: NearbyHospital) => void;
  onCallHospital: (hosp: NearbyHospital) => void;
  onCallDoctor: (doc: NearbyDoctor) => void;
}

type MapEntityItem =
  | { kind: 'hospital'; data: NearbyHospital }
  | { kind: 'doctor'; data: NearbyDoctor };

interface MarkerWithInfoProps {
  position: { lat: number; lng: number };
  title: string;
  zIndex?: number;
  onSelect: (marker: google.maps.marker.AdvancedMarkerElement) => void;
  children: React.ReactNode;
}

const MarkerWithRef: React.FC<MarkerWithInfoProps> = ({
  position,
  title,
  zIndex,
  onSelect,
  children,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      position={position}
      title={title}
      zIndex={zIndex}
      onClick={() => {
        if (marker) {
          soundEffects.playHapticClick();
          onSelect(marker);
        }
      }}
    >
      {children}
    </AdvancedMarker>
  );
};

interface RouteOverlayProps {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  onRouteComputed: (summary: { distanceKm: string; etaMin: string } | null) => void;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  onRouteComputed,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!routesLib || !map || !destination) {
      onRouteComputed(null);
      return;
    }

    let cancelled = false;
    const request = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    const RouteClass = routesLib.Route as unknown as {
      computeRoutes?: (req: unknown) => Promise<{
        routes?: Array<{
          createPolylines: () => google.maps.Polyline[];
          viewport?: google.maps.LatLngBounds;
          distanceMeters?: number;
          durationMillis?: number;
        }>;
      }>;
    };

    if (typeof RouteClass?.computeRoutes !== 'function') {
      return;
    }

    RouteClass.computeRoutes(request)
      .then((res) => {
        if (cancelled) return;
        const primaryRoute = res?.routes?.[0];
        if (!primaryRoute) {
          onRouteComputed(null);
          return;
        }

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#00f1fd',
            strokeOpacity: 0.92,
            strokeWeight: 5,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, 48);
        }

        const km = ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1);
        const mins = Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000));
        onRouteComputed({ distanceKm: `${km} km`, etaMin: `${mins} min` });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteComputed(null);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin.lat, origin.lng, destination?.lat, destination?.lng, onRouteComputed]);

  return null;
};

interface InnerMapContentProps {
  location: DetectedLocation;
  hospitals: NearbyHospital[];
  doctors: NearbyDoctor[];
  selectedHospitalId: string;
  crashDetected?: boolean;
  layerFilter: 'all' | 'hospitals' | 'doctors';
  showRoute: boolean;
  onSelectTargetHospital: (hosp: NearbyHospital) => void;
  onCallHospital: (hosp: NearbyHospital) => void;
  onCallDoctor: (doc: NearbyDoctor) => void;
  onRouteComputed: (summary: { distanceKm: string; etaMin: string } | null) => void;
}

const InnerMapContent: React.FC<InnerMapContentProps> = ({
  location,
  hospitals,
  doctors,
  selectedHospitalId,
  crashDetected,
  layerFilter,
  showRoute,
  onSelectTargetHospital,
  onCallHospital,
  onCallDoctor,
  onRouteComputed,
}) => {
  const status = useApiLoadingStatus();
  const map = useMap();
  const [selectedEntity, setSelectedEntity] = useState<MapEntityItem | null>(null);
  const [selectedMarker, setSelectedMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  const targetHospital =
    hospitals.find((h) => h.id === selectedHospitalId) ||
    hospitals[0] ||
    null;

  // Keep map centered when user switches area preset or refreshes GPS
  useEffect(() => {
    if (map) {
      map.panTo({ lat: location.lat, lng: location.lng });
    }
  }, [map, location.lat, location.lng]);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0e18] text-center p-4 gap-2">
        <span className="material-symbols-outlined text-[32px] text-[#ff5166]">map</span>
        <p className="text-xs font-bold text-white">Google Maps failed to initialize</p>
        <p className="text-[11px] text-[#dfe2f1]/65 max-w-xs">
          Check your Maps API key permissions or quota. Nearest hospitals and rescue lists remain active below.
        </p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      defaultCenter={{ lat: location.lat, lng: location.lng }}
      defaultZoom={13}
      gestureHandling="greedy"
      streetViewControl={false}
      mapTypeControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Victim Live Location / Crash Pin */}
      <AdvancedMarker
        position={{ lat: location.lat, lng: location.lng }}
        title={crashDetected ? 'Crash Impact Location (Victim)' : 'Your Live GPS Location'}
        zIndex={1000}
      >
        <div className="flex flex-col items-center">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,51,75,0.85)] border-2 border-white ${
              crashDetected ? 'bg-[#ff334b] animate-bounce' : 'bg-[#e11d48]'
            }`}
          >
            <span className="material-symbols-outlined text-white text-[18px]">
              {crashDetected ? 'car_crash' : 'two_wheeler'}
            </span>
          </div>
          <span className="mt-1 px-2 py-0.5 rounded-full bg-[#0a0e18]/95 border border-[#ff334b] text-white text-[9px] font-black shadow-md whitespace-nowrap">
            {crashDetected ? 'CRASH SITE' : 'YOU (LIVE)'}
          </span>
        </div>
      </AdvancedMarker>

      {/* Nearby Hospital Markers */}
      {(layerFilter === 'all' || layerFilter === 'hospitals') &&
        hospitals.map((hosp, idx) => {
          const isTarget = targetHospital?.id === hosp.id;
          return (
            <MarkerWithRef
              key={hosp.id}
              position={{ lat: hosp.lat, lng: hosp.lng }}
              title={`${hosp.name} (${hosp.distance})`}
              zIndex={isTarget ? 950 : 600 - idx}
              onSelect={(marker) => {
                setSelectedMarker(marker);
                setSelectedEntity({ kind: 'hospital', data: hosp });
              }}
            >
              <div className="flex flex-col items-center cursor-pointer">
                <Pin
                  background={isTarget ? '#00f1fd' : '#ff334b'}
                  borderColor={isTarget ? '#ffffff' : '#0a0e18'}
                  glyphColor={isTarget ? '#002113' : '#ffffff'}
                  scale={isTarget ? 1.25 : 1.0}
                >
                  H
                </Pin>
                {isTarget && (
                  <span className="mt-0.5 px-1.5 py-0.2 rounded bg-[#00f1fd] text-[#00373a] text-[9px] font-black shadow-md whitespace-nowrap">
                    TARGET ER • {hosp.distance}
                  </span>
                )}
              </div>
            </MarkerWithRef>
          );
        })}

      {/* Nearby Doctor Markers */}
      {(layerFilter === 'all' || layerFilter === 'doctors') &&
        doctors.slice(0, 6).map((doc, idx) => (
          <MarkerWithRef
            key={doc.id}
            position={{ lat: doc.lat, lng: doc.lng }}
            title={`${doc.name} — ${doc.specialty}`}
            zIndex={400 - idx}
            onSelect={(marker) => {
              setSelectedMarker(marker);
              setSelectedEntity({ kind: 'doctor', data: doc });
            }}
          >
            <Pin
              background="#4edea3"
              borderColor="#002113"
              glyphColor="#002113"
              scale={0.95}
            >
              +
            </Pin>
          </MarkerWithRef>
        ))}

      {/* Route Polyline from Victim to Nearest/Target Hospital */}
      {showRoute && targetHospital && (
        <RouteOverlay
          origin={{ lat: location.lat, lng: location.lng }}
          destination={{ lat: targetHospital.lat, lng: targetHospital.lng }}
          onRouteComputed={onRouteComputed}
        />
      )}

      {/* Interactive Marker InfoWindow */}
      {selectedEntity && selectedMarker && (
        <InfoWindow
          anchor={selectedMarker}
          maxWidth={270}
          onCloseClick={() => {
            setSelectedEntity(null);
            setSelectedMarker(null);
          }}
        >
          {selectedEntity.kind === 'hospital' ? (
            <div className="text-[#0D0D11] p-1 space-y-1.5">
              <div className="flex items-center gap-1">
                {targetHospital?.id === selectedEntity.data.id && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-600 text-white text-[9px] font-bold">
                    TARGET ER
                  </span>
                )}
                <span className="text-[10px] font-bold text-rose-700">
                  {selectedEntity.data.distance} • {selectedEntity.data.eta}
                </span>
              </div>
              <h4 className="font-bold text-xs leading-snug">{selectedEntity.data.name}</h4>
              <p className="text-[10px] text-slate-600">{selectedEntity.data.traumaLevel}</p>
              <p className="text-[10px] text-slate-700 font-medium">
                {selectedEntity.data.icuBeds} ICU Beds • {selectedEntity.data.assigned1122Station}
              </p>
              <div className="flex items-center flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onSelectTargetHospital(selectedEntity.data)}
                  className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                >
                  Set ER
                </button>
                <button
                  type="button"
                  onClick={() => onCallHospital(selectedEntity.data)}
                  className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                >
                  Call
                </button>
                <a
                  href={buildWhatsAppUrl(
                    selectedEntity.data.phone,
                    buildEmergencyWhatsAppMessage({
                      recipientName: selectedEntity.data.name,
                      areaName: location.areaName,
                      city: location.city,
                      lat: location.lat,
                      lng: location.lng,
                      hospitalName: selectedEntity.data.name,
                      isCrashActive: crashDetected,
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-[#25D366] text-[#002113] text-[10px] font-bold inline-flex items-center gap-1"
                >
                  <WhatsAppIcon className="w-3 h-3" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEntity.data.lat},${selectedEntity.data.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold"
                >
                  Navigate
                </a>
              </div>
            </div>
          ) : (
            <div className="text-[#0D0D11] p-1 space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-700">
                {selectedEntity.data.distance} • {selectedEntity.data.eta}
              </span>
              <h4 className="font-bold text-xs leading-snug">{selectedEntity.data.name}</h4>
              <p className="text-[10px] text-slate-600">{selectedEntity.data.specialty}</p>
              <p className="text-[10px] text-slate-700">{selectedEntity.data.clinicName}</p>
              <div className="flex items-center flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onCallDoctor(selectedEntity.data)}
                  className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                >
                  Call Doctor
                </button>
                <a
                  href={buildWhatsAppUrl(
                    selectedEntity.data.phone,
                    buildEmergencyWhatsAppMessage({
                      recipientName: selectedEntity.data.name,
                      areaName: location.areaName,
                      city: location.city,
                      lat: location.lat,
                      lng: location.lng,
                      isCrashActive: crashDetected,
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-[#25D366] text-[#002113] text-[10px] font-bold inline-flex items-center gap-1"
                >
                  <WhatsAppIcon className="w-3 h-3" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEntity.data.lat},${selectedEntity.data.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold"
                >
                  Navigate
                </a>
              </div>
            </div>
          )}
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export const LiveEmergencyMap: React.FC<LiveEmergencyMapProps> = ({
  mapsApiKey,
  location,
  hospitals,
  doctors,
  selectedHospitalId,
  crashDetected,
  onSelectTargetHospital,
  onCallHospital,
  onCallDoctor,
}) => {
  const [layerFilter, setLayerFilter] = useState<'all' | 'hospitals' | 'doctors'>('all');
  const [showRoute, setShowRoute] = useState(true);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: string; etaMin: string } | null>(
    null
  );

  const handleRouteComputed = useCallback(
    (summary: { distanceKm: string; etaMin: string } | null) => {
      setRouteSummary(summary);
    },
    []
  );

  const targetHospital =
    hospitals.find((h) => h.id === selectedHospitalId) ||
    hospitals[0] ||
    null;

  return (
    <div className="rounded-2xl bg-[#1c1f2a] border border-[#00f1fd]/40 overflow-hidden shadow-xl">
      {/* Header Bar */}
      <div className="p-3.5 bg-[#171b26] border-b border-[#262a35] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#00f1fd]/20 text-[#00f1fd] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[19px]">map</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-black text-white uppercase tracking-wide">
                Live Google Emergency Map
              </span>
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
            </div>
            <span className="text-[10px] text-[#dfe2f1]/70 block truncate">
              {location.areaName}, {location.city} • {hospitals.length} ERs &amp; {doctors.length}{' '}
              Doctors
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {routeSummary && (
            <span className="px-2 py-1 rounded-lg bg-[#00f1fd]/15 border border-[#00f1fd]/40 text-[#00f1fd] text-[10px] font-mono-num font-bold">
              Route: {routeSummary.distanceKm} ({routeSummary.etaMin})
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              soundEffects.playHapticClick();
              setShowRoute((prev) => !prev);
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
              showRoute
                ? 'bg-[#00f1fd] text-[#00373a]'
                : 'bg-[#262a35] text-[#dfe2f1]/80 hover:text-white'
            }`}
          >
            {showRoute ? 'Route ON' : 'Show Route'}
          </button>
        </div>
      </div>

      {/* Layer Filters */}
      <div className="px-3 py-2 bg-[#121622] border-b border-[#262a35] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all' as const, label: 'All Pins' },
            { id: 'hospitals' as const, label: 'Hospitals' },
            { id: 'doctors' as const, label: 'Doctors' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEffects.playHapticClick();
                setLayerFilter(tab.id);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                layerFilter === tab.id
                  ? 'bg-[#4edea3] text-[#002113]'
                  : 'bg-[#1c1f2a] text-[#dfe2f1]/75 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {targetHospital && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${targetHospital.lat},${targetHospital.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-[#00f1fd] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px]">directions</span>
            <span>Open Directions to {targetHospital.name.split(' ')[0]} ER</span>
          </a>
        )}
      </div>

      {/* Map Container with Explicit Height (CF2) */}
      <div className="w-full h-[300px] sm:h-[360px] lg:h-[420px] relative bg-[#0a0e18]">
        {mapsApiKey ? (
          <APIProvider
            apiKey={mapsApiKey}
            libraries={['marker', 'routes']}
            language="en"
            region="PK"
          >
            <InnerMapContent
              location={location}
              hospitals={hospitals}
              doctors={doctors}
              selectedHospitalId={selectedHospitalId}
              crashDetected={crashDetected}
              layerFilter={layerFilter}
              showRoute={showRoute}
              onSelectTargetHospital={onSelectTargetHospital}
              onCallHospital={onCallHospital}
              onCallDoctor={onCallDoctor}
              onRouteComputed={handleRouteComputed}
            />
          </APIProvider>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center gap-2">
            <span className="material-symbols-outlined text-[34px] text-[#00f1fd] animate-pulse">
              satellite_alt
            </span>
            <p className="text-xs font-bold text-white">Google Maps Key Initializing</p>
            <p className="text-[11px] text-[#dfe2f1]/65 max-w-xs">
              Configure VITE_GOOGLE_MAPS_API_KEY in your environment to render interactive Google Map tiles.
            </p>
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="px-3.5 py-2 bg-[#171b26] border-t border-[#262a35] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#dfe2f1]/75">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff334b]" /> Victim / ER
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f1fd]" /> Target / Nearest ER
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4edea3]" /> Nearby Doctor
          </span>
        </div>
        <span className="text-[10px] text-[#dfe2f1]/55">
          Tap any marker for Call, WhatsApp &amp; ER Selection
        </span>
      </div>
    </div>
  );
};
