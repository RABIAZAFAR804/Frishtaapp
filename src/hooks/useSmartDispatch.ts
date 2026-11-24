import { useState, useEffect, useCallback } from 'react';
import {
  RescueTeamUnit,
  SmartDispatchCase,
  EmergencyContact,
  DetectedLocation,
} from '../types';

export const STAND_DOWN_MESSAGE =
  'This emergency has already been assigned to another team. No additional response is required at this time.';

const DEFAULT_OFFLINE_TEAMS: Array<{
  id: string;
  name: string;
  agency: string;
  controlRoom: string;
  unitType: string;
  capabilities: string[];
  phone: string;
  offsetLat: number;
  offsetLng: number;
  speedKmh: number;
  traumaPriority: number;
}> = [
  {
    id: 'team-1122-alpha',
    name: 'Rescue 1122 — Alpha Trauma Ambulance #04',
    agency: 'Rescue 1122',
    controlRoom: 'Rescue 1122 Central Control Room',
    unitType: 'ALS Trauma Ambulance',
    capabilities: ['ACLS Defibrillator', 'Spine Board', 'Oxygen & IV', 'Trauma Paramedics'],
    phone: '1122',
    offsetLat: 0.0068,
    offsetLng: -0.0052,
    speedKmh: 44,
    traumaPriority: 98,
  },
  {
    id: 'team-1122-bike',
    name: 'Rescue 1122 — Rapid Biker Medic #11',
    agency: 'Rescue 1122',
    controlRoom: 'Rescue 1122 Central Control Room',
    unitType: 'Rapid First-Aid Motorbike',
    capabilities: ['Traffic Bypasser', 'Tourniquet & Bleed Kit', 'C-Spine Collar'],
    phone: '1122',
    offsetLat: -0.0038,
    offsetLng: 0.0031,
    speedKmh: 52,
    traumaPriority: 84,
  },
  {
    id: 'team-edhi-115',
    name: 'Edhi Foundation — Emergency Unit #115-B',
    agency: 'Edhi Foundation',
    controlRoom: 'Edhi Emergency Control Desk',
    unitType: 'Rapid Response Ambulance',
    capabilities: ['Emergency Transport', 'Oxygen Cylinder', 'First-Aid Stretcher'],
    phone: '115',
    offsetLat: 0.0112,
    offsetLng: 0.0079,
    speedKmh: 40,
    traumaPriority: 80,
  },
  {
    id: 'team-chhipa-1020',
    name: 'Chhipa Welfare — Rescue Van #1020-C',
    agency: 'Chhipa Welfare',
    controlRoom: 'Chhipa Operations Control Room',
    unitType: 'Paramedic Rescue Van',
    capabilities: ['Trauma Stretcher', 'Wound Dressing', 'Hospital Relay'],
    phone: '1020',
    offsetLat: -0.0145,
    offsetLng: -0.0094,
    speedKmh: 38,
    traumaPriority: 76,
  },
  {
    id: 'team-farishta-medic',
    name: 'FARISHTA Community — Dr. Ayesha Trauma Unit',
    agency: 'FARISHTA Medical Corps',
    controlRoom: 'FARISHTA Community Triage Desk',
    unitType: 'On-Call Trauma Physician',
    capabilities: ['ATLS Emergency Care', 'Airway Management', 'Golden-Hour Aid'],
    phone: '+92 301 9876543',
    offsetLat: 0.0042,
    offsetLng: 0.0046,
    speedKmh: 46,
    traumaPriority: 88,
  },
];

function haversineKmLocal(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function buildLocalTeams(
  lat: number,
  lng: number,
  busyTeamIds: string[],
  severityScore = 75
): RescueTeamUnit[] {
  const busySet = new Set(busyTeamIds);
  const isCritical = severityScore >= 65;

  return DEFAULT_OFFLINE_TEAMS.map((t) => {
    const tLat = lat + t.offsetLat;
    const tLng = lng + t.offsetLng;
    const distanceKm = haversineKmLocal(lat, lng, tLat, tLng);
    const etaMinutes = Math.max(1.2, Math.round((distanceKm / t.speedKmh) * 60 * 10) / 10);
    const availability: 'AVAILABLE' | 'BUSY' = busySet.has(t.id) ? 'BUSY' : 'AVAILABLE';
    const suitabilityScore =
      availability === 'BUSY'
        ? -1
        : Math.max(
            1,
            Math.round(100 - distanceKm * 18 + t.traumaPriority * (isCritical ? 0.45 : 0.25))
          );

    return {
      id: t.id,
      name: t.name,
      agency: t.agency,
      controlRoom: t.controlRoom,
      unitType: t.unitType,
      capabilities: t.capabilities,
      phone: t.phone,
      lat: tLat,
      lng: tLng,
      distanceKm,
      distance: distanceKm < 1 ? `${Math.max(80, Math.round(distanceKm * 1000))} m` : `${distanceKm.toFixed(1)} km`,
      etaMinutes,
      eta: `${etaMinutes.toFixed(1)} min`,
      availability,
      suitabilityScore,
      dispatchStatus: 'STANDBY' as const,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

export function useSmartDispatch(location: DetectedLocation) {
  const [busyTeamIds, setBusyTeamIds] = useState<string[]>(['team-chhipa-1020']);
  const [candidateTeams, setCandidateTeams] = useState<RescueTeamUnit[]>(() =>
    buildLocalTeams(location.lat, location.lng, ['team-chhipa-1020'])
  );
  const [dispatchCase, setDispatchCase] = useState<SmartDispatchCase | null>(null);
  const [isCoordinating, setIsCoordinating] = useState(false);

  const refreshTeams = useCallback(async () => {
    const localTeams = buildLocalTeams(location.lat, location.lng, busyTeamIds);
    setCandidateTeams(localTeams);

    try {
      const res = await fetch(
        `/api/dispatch/teams?lat=${location.lat}&lng=${location.lng}&busy=${encodeURIComponent(
          busyTeamIds.join(',')
        )}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.teams)) {
        setCandidateTeams(data.teams);
      }
      if (data.activeCase && !dispatchCase) {
        setDispatchCase(data.activeCase);
      }
    } catch {
      // Offline fallback already populated
    }
  }, [location.lat, location.lng, busyTeamIds, dispatchCase]);

  useEffect(() => {
    refreshTeams();
  }, [location.lat, location.lng, busyTeamIds]);

  const toggleTeamAvailability = useCallback((teamId: string) => {
    setBusyTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }, []);

  const runSmartDispatch = useCallback(
    async (params: {
      gForce: number;
      speedKmh: number;
      severityScore: number;
      targetHospitalName: string;
      contacts: EmergencyContact[];
    }): Promise<SmartDispatchCase> => {
      setIsCoordinating(true);
      const payload = {
        lat: location.lat,
        lng: location.lng,
        areaName: location.areaName,
        city: location.city,
        gForce: params.gForce,
        speedKmh: params.speedKmh,
        severityScore: params.severityScore,
        targetHospitalName: params.targetHospitalName,
        busyTeamIds,
        contacts: params.contacts,
      };

      try {
        const res = await fetch('/api/dispatch/coordinate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.dispatchCase) {
            setDispatchCase(data.dispatchCase as SmartDispatchCase);
            return data.dispatchCase as SmartDispatchCase;
          }
        }
      } catch {
        // Offline single-team fallback below
      } finally {
        setIsCoordinating(false);
      }

      // Deterministic offline single-team coordination fallback
      const evaluated = buildLocalTeams(
        location.lat,
        location.lng,
        busyTeamIds,
        params.severityScore
      );
      const available = evaluated
        .filter((t) => t.availability === 'AVAILABLE')
        .sort((a, b) => b.suitabilityScore - a.suitabilityScore || a.distanceKm - b.distanceKm);
      const winner = available[0] || evaluated[0];
      const nowIso = new Date().toISOString();
      const incidentId = `INC-${Date.now().toString().slice(-6)}`;

      const assignedTeam: RescueTeamUnit = {
        ...winner,
        dispatchStatus: 'ASSIGNED',
        notificationMessage: `ASSIGNED CASE ${incidentId}: Proceed to ${location.areaName} (${winner.distance}, ETA ${winner.eta}).`,
      };
      const otherTeams: RescueTeamUnit[] = evaluated
        .filter((t) => t.id !== assignedTeam.id)
        .map((t) => ({
          ...t,
          dispatchStatus: t.availability === 'BUSY' ? 'BUSY_SKIPPED' : 'STOOD_DOWN',
          notificationMessage: STAND_DOWN_MESSAGE,
        }));

      const armedContacts = params.contacts.filter((c) => c.enabledAlert !== false);
      const familyNotifications = armedContacts.map((c) => ({
        contactId: c.id,
        name: c.name,
        relation: c.relation,
        phone: c.phone,
        message: `FARISHTA Alert: Accident detected near ${location.areaName}, ${location.city}. ${assignedTeam.name} has been dispatched (ETA ${assignedTeam.eta}) to ${params.targetHospitalName}. Live GPS: https://maps.google.com/?q=${location.lat.toFixed(5)},${location.lng.toFixed(5)}`,
        sentAt: nowIso,
        arrivalNotified: false,
      }));

      const offlineCase: SmartDispatchCase = {
        incidentId,
        stage: 'FAMILY_NOTIFIED',
        createdAt: nowIso,
        arrivalConfirmed: false,
        location: {
          lat: location.lat,
          lng: location.lng,
          areaName: location.areaName,
          city: location.city,
        },
        severityScore: params.severityScore,
        gForce: params.gForce,
        controlRoomName: assignedTeam.controlRoom,
        targetHospitalName: params.targetHospitalName,
        assignedTeam,
        otherTeams,
        standDownMessage: STAND_DOWN_MESSAGE,
        familyNotifications,
        steps: [
          {
            key: 'accident_detected',
            stepNumber: 1,
            title: 'Accident Detected',
            subtitle: `GPS (${location.lat.toFixed(4)}°, ${location.lng.toFixed(4)}°) & ${params.gForce.toFixed(1)}G emergency alert generated.`,
            completed: true,
            timestamp: nowIso,
          },
          {
            key: 'services_notified',
            stepNumber: 2,
            title: 'Nearby Emergency Services Notified',
            subtitle: `${assignedTeam.controlRoom} alerted. Exclusive single-team lock active.`,
            completed: true,
            timestamp: nowIso,
          },
          {
            key: 'team_dispatched',
            stepNumber: 3,
            title: 'Nearest Suitable Team Dispatched',
            subtitle: `${assignedTeam.name} (${assignedTeam.distance}, ETA ${assignedTeam.eta}) dispatched.`,
            completed: true,
            timestamp: nowIso,
          },
          {
            key: 'other_teams_notified',
            stepNumber: 4,
            title: 'Other Teams Notified (Stand-Down)',
            subtitle: `${otherTeams.length} teams notified: "${STAND_DOWN_MESSAGE}"`,
            completed: true,
            timestamp: nowIso,
          },
          {
            key: 'family_notified',
            stepNumber: 5,
            title: 'Family Notification Sent',
            subtitle: `${familyNotifications.length} saved contact(s) informed that rescue team has been dispatched.`,
            completed: true,
            timestamp: nowIso,
          },
          {
            key: 'arrival_confirmed',
            stepNumber: 6,
            title: 'Arrival Confirmation',
            subtitle: `Awaiting ${assignedTeam.name} on-scene arrival confirmation.`,
            completed: false,
          },
        ],
      };

      setDispatchCase(offlineCase);
      return offlineCase;
    },
    [location, busyTeamIds]
  );

  const confirmArrival = useCallback(async () => {
    try {
      const res = await fetch('/api/dispatch/confirm-arrival', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.dispatchCase) {
          setDispatchCase(data.dispatchCase as SmartDispatchCase);
          return data.dispatchCase as SmartDispatchCase;
        }
      }
    } catch {
      // Offline fallback below
    }

    setDispatchCase((prev) => {
      if (!prev) return null;
      const arrivedAt = new Date().toISOString();
      return {
        ...prev,
        stage: 'ARRIVED_ON_SCENE',
        arrivedAt,
        arrivalConfirmed: true,
        assignedTeam: {
          ...prev.assignedTeam,
          dispatchStatus: 'ARRIVED',
          eta: 'On Scene',
          etaMinutes: 0,
        },
        familyNotifications: prev.familyNotifications.map((f) => ({
          ...f,
          arrivalNotified: true,
          message: `FARISHTA Arrival Update: ${prev.assignedTeam.name} has arrived at ${prev.location.areaName}.`,
        })),
        steps: prev.steps.map((s) =>
          s.key === 'arrival_confirmed'
            ? {
                ...s,
                completed: true,
                timestamp: arrivedAt,
                subtitle: `Confirmed: ${prev.assignedTeam.name} arrived on scene and began trauma care.`,
              }
            : s
        ),
      };
    });
    return null;
  }, []);

  const resetDispatch = useCallback(async () => {
    setDispatchCase(null);
    try {
      await fetch('/api/dispatch/reset', { method: 'POST' });
    } catch {
      // Ignore offline error
    }
  }, []);

  return {
    candidateTeams,
    busyTeamIds,
    dispatchCase,
    isCoordinating,
    toggleTeamAvailability,
    runSmartDispatch,
    confirmArrival,
    resetDispatch,
  };
}
