import React from 'react';
import { motion } from 'motion/react';
import {
  DetectedLocation,
  NearbyDoctor,
  NearbyHospital,
  EmergencyService,
} from '../types';
import { AREA_PRESETS } from '../hooks/useLocationAndNearby';
import { soundEffects } from '../utils/audio';
import { buildWhatsAppUrl, buildEmergencyWhatsAppMessage } from '../utils/whatsapp';
import { WhatsAppIcon } from './WhatsAppIcon';

interface NearbyDoctorsHospitalsSectionProps {
  location: DetectedLocation;
  doctors: NearbyDoctor[];
  hospitals: NearbyHospital[];
  isLoading: boolean;
  selectedPresetId: string;
  selectedHospitalId: string;
  onSelectPreset: (id: string) => void;
  onRefreshGPS: () => void;
  onSelectTargetHospital: (hospital: NearbyHospital) => void;
  onCallDoctor: (doc: NearbyDoctor) => void;
  onRouteDoctor: (doc: NearbyDoctor) => void;
  onCallHospital: (hosp: NearbyHospital) => void;
  onRouteHospital: (hosp: NearbyHospital) => void;
}

export function doctorToServiceTarget(doc: NearbyDoctor): EmergencyService {
  return {
    id: doc.id,
    name: doc.name,
    category: 'community',
    shortCode: 'Doctor',
    phone: doc.phone,
    address: `${doc.clinicName} • ${doc.address}`,
    distance: doc.distance,
    distanceKm: doc.distanceKm,
    eta: doc.eta,
    badge: `${doc.specialty} (${doc.qualification})`,
    description: doc.clinicName,
    status: doc.onCallNow ? 'On-Call Available Now' : 'Clinic Active',
    verified: doc.verified,
    capabilities: [doc.specialty, doc.available24x7 ? '24/7 Emergency' : 'Clinic Hours'],
    icon: 'stethoscope',
    color: doc.color,
    coords: { x: 50, y: 50 },
  };
}

export function hospitalToServiceTarget(hosp: NearbyHospital): EmergencyService {
  return {
    id: hosp.id,
    name: hosp.name,
    category: 'hospital',
    shortCode: 'ER',
    phone: hosp.phone,
    address: hosp.address,
    distance: hosp.distance,
    distanceKm: hosp.distanceKm,
    eta: hosp.eta,
    badge: hosp.traumaLevel,
    description: `${hosp.type} • ${hosp.icuBeds} ICU Beds`,
    status: `${hosp.icuBeds} ICU Beds Open`,
    verified: true,
    capabilities: [hosp.traumaLevel, hosp.assigned1122Station],
    icon: 'local_hospital',
    color: '#ff334b',
    coords: { x: 50, y: 50 },
  };
}

export const NearbyDoctorsHospitalsSection: React.FC<NearbyDoctorsHospitalsSectionProps> = ({
  location,
  doctors,
  hospitals,
  isLoading,
  selectedPresetId,
  selectedHospitalId,
  onSelectPreset,
  onRefreshGPS,
  onSelectTargetHospital,
  onCallDoctor,
  onRouteDoctor,
  onCallHospital,
  onRouteHospital,
}) => {
  return (
    <div className="space-y-4">
      {/* Live Area & Location Detection Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-[#17252f] via-[#1c1f2a] to-[#171b26] border border-[#00f1fd]/40 p-4 shadow-xl space-y-3"
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-[#00f1fd]/20 text-[#00f1fd] border border-[#00f1fd]/40 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">my_location</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#00f1fd]">
                  AUTO AREA LOCATION DETECTED
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4edea3]/20 text-[#4edea3] font-mono-num font-bold">
                  {location.source === 'gps' ? 'LIVE GPS' : 'AREA ZONE'}
                </span>
              </div>
              <h3 className="font-display text-sm font-black text-white truncate mt-0.5">
                {location.areaName}, {location.city}
              </h3>
              <p className="text-[10px] text-[#dfe2f1]/70 font-mono-num">
                {location.lat.toFixed(4)}° N, {location.lng.toFixed(4)}° E • ±{location.accuracyMeters}m
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEffects.playHapticClick();
              onRefreshGPS();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#00f1fd] text-[#00373a] text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[15px]">
              {isLoading ? 'sync' : 'gps_fixed'}
            </span>
            <span>{isLoading ? 'Scanning...' : 'Detect GPS'}</span>
          </button>
        </div>

        {/* Area Selector Pills (for instant testing when entering any area) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {AREA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                soundEffects.playHapticClick();
                onSelectPreset(preset.id);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors shrink-0 ${
                selectedPresetId === preset.id
                  ? 'bg-[#4edea3] text-[#002113]'
                  : 'bg-[#171b26] border border-[#262a35] text-[#dfe2f1]/75 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Nearest Doctors in Detected Area */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#4edea3]">
              stethoscope
            </span>
            <h3 className="font-display text-sm font-black text-white">
              Nearest Doctors in Your Area
            </h3>
          </div>
          <span className="text-[10px] font-mono-num font-bold text-[#4edea3] bg-[#4edea3]/15 px-2 py-0.5 rounded-full">
            {doctors.length} NEARBY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2.5">
          {doctors.slice(0, 4).map((doc, idx) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={{ y: -2 }}
              className="rounded-2xl bg-[#1c1f2a] border border-[#262a35] hover:border-[#4edea3]/50 p-3.5 shadow-md flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                    style={{
                      backgroundColor: `${doc.color}22`,
                      color: doc.color,
                      border: `1px solid ${doc.color}55`,
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-display text-xs font-bold text-white truncate">
                        {doc.name}
                      </span>
                      {doc.available24x7 && (
                        <span className="px-1.5 py-0.2 rounded bg-[#4edea3]/20 text-[#4edea3] text-[9px] font-black">
                          24/7 ON-CALL
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#00f1fd] font-semibold block truncate">
                      {doc.specialty} • {doc.qualification}
                    </span>
                    <span className="text-[10px] text-[#dfe2f1]/65 block truncate">
                      {doc.clinicName} — {doc.address}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-[#4edea3] font-mono-num block">
                    {doc.distance}
                  </span>
                  <span className="text-[10px] font-bold text-[#00f1fd] font-mono-num block">
                    {doc.eta} ETA
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-[#262a35]">
                <span className="text-[10px] text-[#dfe2f1]/70 font-mono-num">
                  {doc.phone}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playHapticClick();
                      onRouteDoctor(doc);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#262a35] hover:bg-[#313540] text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px] text-[#00f1fd]">
                      navigation
                    </span>
                    <span>Route</span>
                  </button>
                  <a
                    href={buildWhatsAppUrl(
                      doc.phone,
                      buildEmergencyWhatsAppMessage({
                        recipientName: doc.name,
                        areaName: location.areaName,
                        city: location.city,
                        lat: location.lat,
                        lng: location.lng,
                      })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => soundEffects.playHapticClick()}
                    title={`Contact ${doc.name} on WhatsApp`}
                    className="px-2.5 py-1.5 rounded-xl bg-[#25D366] text-[#002113] text-[11px] font-black flex items-center gap-1 shadow-sm hover:brightness-110 active:scale-95 transition-all"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playHapticClick();
                      onCallDoctor(doc);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#4edea3] text-[#002113] text-[11px] font-black flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    <span>Call</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Nearest Hospitals to Victim */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#ff334b]">
              local_hospital
            </span>
            <h3 className="font-display text-sm font-black text-white">
              Nearest Hospitals to Victim
            </h3>
          </div>
          <span className="text-[10px] font-mono-num font-bold text-[#ff334b] bg-[#ff334b]/15 px-2 py-0.5 rounded-full">
            GPS DISTANCE SORTED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2.5">
          {hospitals.slice(0, 4).map((hosp, idx) => {
            const isTarget = selectedHospitalId === hosp.id;
            return (
              <motion.div
                key={hosp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ y: -2 }}
                className={`rounded-2xl p-3.5 border shadow-md flex flex-col gap-2.5 ${
                  isTarget
                    ? 'bg-[#211720] border-[#ff334b]'
                    : 'bg-[#1c1f2a] border-[#262a35] hover:border-[#ff334b]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#ff334b]/20 border border-[#ff334b]/50 text-[#ff334b] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">local_hospital</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-xs font-bold text-white truncate">
                          {hosp.name}
                        </span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-[#ff334b] text-white text-[9px] font-black">
                            CLOSEST ER
                          </span>
                        )}
                        {isTarget && (
                          <span className="px-1.5 py-0.2 rounded bg-[#4edea3] text-[#002113] text-[9px] font-black">
                            VICTIM TARGET
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#ffb3b5] font-semibold block truncate">
                        {hosp.traumaLevel} • {hosp.icuBeds} ICU Beds
                      </span>
                      <span className="text-[10px] text-[#dfe2f1]/65 block truncate">
                        {hosp.address}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-[#4edea3] font-mono-num block">
                      {hosp.distance}
                    </span>
                    <span className="text-[10px] font-bold text-[#00f1fd] font-mono-num block">
                      {hosp.eta} ETA
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#262a35] flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playHapticClick();
                      onSelectTargetHospital(hosp);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-colors ${
                      isTarget
                        ? 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40'
                        : 'bg-[#171b26] border border-[#313540] text-[#dfe2f1]/80 hover:text-white'
                    }`}
                  >
                    {isTarget ? '✓ Active Victim ER' : 'Set as Victim ER'}
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playHapticClick();
                        onRouteHospital(hosp);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#262a35] hover:bg-[#313540] text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px] text-[#00f1fd]">
                        navigation
                      </span>
                      <span>Route</span>
                    </button>
                    <a
                      href={buildWhatsAppUrl(
                        hosp.phone,
                        buildEmergencyWhatsAppMessage({
                          recipientName: hosp.name,
                          areaName: location.areaName,
                          city: location.city,
                          lat: location.lat,
                          lng: location.lng,
                          hospitalName: hosp.name,
                        })
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => soundEffects.playHapticClick()}
                      title={`WhatsApp ${hosp.name}`}
                      className="px-2.5 py-1.5 rounded-xl bg-[#25D366] text-[#002113] text-[11px] font-black flex items-center gap-1 shadow-sm hover:brightness-110 active:scale-95 transition-all"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playHapticClick();
                        onCallHospital(hosp);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#ff334b] text-white text-[11px] font-black flex items-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      <span>Call ER</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
