import { useState, useEffect, useCallback } from 'react';
import {
  DetectedLocation,
  NearbyDoctor,
  NearbyHospital,
  PredictiveWarning,
} from '../types';
import { HOSPITAL_DESTINATIONS } from '../data/emergencyServices';

const NEARBY_CACHE_KEY = 'farishta_nearby_cache_v1';

export interface AreaPreset {
  id: string;
  label: string;
  areaName: string;
  city: string;
  lat: number;
  lng: number;
}

export const AREA_PRESETS: AreaPreset[] = [
  { id: 'gps', label: 'Live GPS', areaName: 'Detecting GPS...', city: 'Auto', lat: 31.5204, lng: 74.3587 },
  { id: 'gulberg', label: 'Gulberg, Lahore', areaName: 'Gulberg III & Main Market', city: 'Lahore', lat: 31.5204, lng: 74.3587 },
  { id: 'dha', label: 'DHA Phase 5, LHE', areaName: 'DHA Phase 5 & Ring Road', city: 'Lahore', lat: 31.4697, lng: 74.4071 },
  { id: 'model-town', label: 'Model Town, LHE', areaName: 'Model Town & Ferozepur Rd', city: 'Lahore', lat: 31.4839, lng: 74.3257 },
  { id: 'islamabad', label: 'F-7, Islamabad', areaName: 'Blue Area & F-7 Markaz', city: 'Islamabad', lat: 33.7215, lng: 73.0433 },
  { id: 'karachi', label: 'Clifton, Karachi', areaName: 'Clifton & Shahrah-e-Faisal', city: 'Karachi', lat: 24.8138, lng: 67.0299 },
];

const FALLBACK_DOCTORS: NearbyDoctor[] = [
  {
    id: 'doc-ayesha',
    name: 'Dr. Ayesha Malik',
    specialty: 'Emergency & Trauma Physician',
    qualification: 'MBBS, FCPS (Emergency Med)',
    clinicName: 'Gulberg Urgent Trauma Clinic',
    address: 'Main Boulevard, Gulberg II, Lahore',
    distance: '350 m',
    distanceKm: 0.35,
    eta: '1.8 min',
    phone: '+92 301 9876543',
    available24x7: true,
    onCallNow: true,
    verified: true,
    lat: 31.5228,
    lng: 74.3548,
    color: '#4edea3',
  },
  {
    id: 'doc-kamran',
    name: 'Dr. Kamran Siddiqui',
    specialty: 'Orthopedic & Bike Injury Surgeon',
    qualification: 'MBBS, MS (Ortho)',
    clinicName: 'Liberty Bone & Fracture Care',
    address: 'Liberty Roundabout, Gulberg III, Lahore',
    distance: '1.1 km',
    distanceKm: 1.1,
    eta: '2.5 min',
    phone: '+92 321 4412890',
    available24x7: true,
    onCallNow: true,
    verified: true,
    lat: 31.5112,
    lng: 74.3425,
    color: '#00f1fd',
  },
];

export function useLocationAndNearby(currentSpeedKmh: number) {
  const [location, setLocation] = useState<DetectedLocation>({
    lat: 31.5204,
    lng: 74.3587,
    areaName: 'Gulberg III & Main Market',
    city: 'Lahore',
    accuracyMeters: 4.2,
    source: 'preset',
    updatedAt: new Date().toISOString(),
  });
  const [doctors, setDoctors] = useState<NearbyDoctor[]>(FALLBACK_DOCTORS);
  const [hospitals, setHospitals] = useState<NearbyHospital[]>(
    HOSPITAL_DESTINATIONS.map((h) => ({
      ...h,
      lat: 31.52,
      lng: 74.35,
      emergencyOpen: true,
    }))
  );
  const [predictiveWarning, setPredictiveWarning] = useState<PredictiveWarning | null>(null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('gps');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Hydrate offline cache immediately (expire after 24h)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NEARBY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const ageMs = Date.now() - Number(parsed.cachedAt || 0);
        if (ageMs < 24 * 60 * 60 * 1000) {
          if (Array.isArray(parsed.doctors) && parsed.doctors.length > 0) setDoctors(parsed.doctors);
          if (Array.isArray(parsed.hospitals) && parsed.hospitals.length > 0) setHospitals(parsed.hospitals);
          if (parsed.location) setLocation(parsed.location);
        } else {
          localStorage.removeItem(NEARBY_CACHE_KEY);
        }
      }
    } catch {
      // Ignore invalid cache
    }
  }, []);

  const fetchNearbyFromLocalApi = useCallback(
    async (lat: number, lng: number, source: 'gps' | 'preset', accuracyMeters = 4.2) => {
      setIsLoadingNearby(true);
      try {
        const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}`);
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!res.ok) throw new Error('Nearby API failed');
        const data = await res.json();

        if (data?.mapsQuotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }

        const nextLoc: DetectedLocation = {
          lat,
          lng,
          areaName: data.areaName,
          city: data.city,
          accuracyMeters,
          source,
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
        setLocation(nextLoc);
        if (Array.isArray(data.doctors)) setDoctors(data.doctors);
        if (Array.isArray(data.hospitals)) setHospitals(data.hospitals);

        localStorage.setItem(
          NEARBY_CACHE_KEY,
          JSON.stringify({
            cachedAt: Date.now(),
            location: nextLoc,
            doctors: data.doctors,
            hospitals: data.hospitals,
          })
        );
      } catch {
        // Offline fallback keeps cached doctors & hospitals intact
      } finally {
        setIsLoadingNearby(false);
      }
    },
    []
  );

  const fetchPredictiveAlert = useCallback(
    async (lat: number, lng: number, speed: number) => {
      try {
        const res = await fetch(`/api/alerts/predictive?lat=${lat}&lng=${lng}&speed=${speed}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.warning) {
          setPredictiveWarning(data.warning);
        }
      } catch {
        // Offline predictive fallback
        setPredictiveWarning({
          id: `pred-offline-${Date.now()}`,
          title: 'Early Safety Alert: Hazard Zone 24 Min Ahead',
          message: `Offline safety radar active for ${location.areaName}. Keep speed under 50 km/h through upcoming intersections.`,
          leadTimeMinutes: 24,
          riskLevel: speed >= 65 ? 'high' : 'moderate',
          recommendedMaxSpeedKmh: 50,
          hazardType: 'blackspot',
          zoneName: `${location.areaName}, ${location.city}`,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [location.areaName, location.city]
  );

  // Detect real GPS when selectedPresetId === 'gps'
  const detectLiveGPS = useCallback(() => {
    setSelectedPresetId('gps');
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchNearbyFromLocalApi(
            pos.coords.latitude,
            pos.coords.longitude,
            'gps',
            Math.round(pos.coords.accuracy || 5)
          );
          fetchPredictiveAlert(pos.coords.latitude, pos.coords.longitude, currentSpeedKmh);
        },
        () => {
          // If GPS denied or unavailable in desktop/sandbox, query default area via local API
          fetchNearbyFromLocalApi(31.5204, 74.3587, 'preset', 8);
          fetchPredictiveAlert(31.5204, 74.3587, currentSpeedKmh);
        },
        { enableHighAccuracy: true, timeout: 4500 }
      );
    } else {
      fetchNearbyFromLocalApi(31.5204, 74.3587, 'preset', 8);
      fetchPredictiveAlert(31.5204, 74.3587, currentSpeedKmh);
    }
  }, [fetchNearbyFromLocalApi, fetchPredictiveAlert, currentSpeedKmh]);

  useEffect(() => {
    detectLiveGPS();
  }, []);

  // Re-evaluate 20-30 min predictive warning periodically when speed changes significantly
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPredictiveAlert(location.lat, location.lng, currentSpeedKmh);
    }, 600);
    return () => clearTimeout(t);
  }, [currentSpeedKmh, location.lat, location.lng, fetchPredictiveAlert]);

  const selectAreaPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'gps') {
      detectLiveGPS();
      return;
    }
    const found = AREA_PRESETS.find((p) => p.id === presetId);
    if (found) {
      fetchNearbyFromLocalApi(found.lat, found.lng, 'preset', 3.5);
      fetchPredictiveAlert(found.lat, found.lng, currentSpeedKmh);
    }
  };

  const requestAndSendPredictiveNotification = async (customWarning?: PredictiveWarning) => {
    const warn = customWarning || predictiveWarning;
    if (!warn) return false;

    if (typeof Notification === 'undefined') return false;
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
    if (perm === 'granted') {
      try {
        new Notification(`⚠️ FARISHTA (${warn.leadTimeMinutes} min ahead)`, {
          body: warn.message,
          icon: '/pwa-192x192.png',
          tag: 'farishta-predictive-alert',
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  return {
    location,
    doctors,
    hospitals,
    predictiveWarning,
    isLoadingNearby,
    selectedPresetId,
    notificationPermission,
    detectLiveGPS,
    selectAreaPreset,
    requestAndSendPredictiveNotification,
    refreshPredictive: () => fetchPredictiveAlert(location.lat, location.lng, currentSpeedKmh),
  };
}
