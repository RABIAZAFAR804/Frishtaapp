import React, { useState, useEffect } from 'react';
import {
  UserRoleMode,
  RescueSystemConfig,
  EmergencyContact,
  DetectedLocation,
  NearbyDoctor,
  NearbyHospital,
  PredictiveWarning,
  SmartSensorState,
  EmergencyService,
  RescueTeamUnit,
  SmartDispatchCase,
} from '../types';
import { soundEffects } from '../utils/audio';
import { Farishta3DScene } from './Farishta3DScene';
import { SmartDetectionPanel } from './SmartDetectionPanel';
import { SmartDispatchCard } from './SmartDispatchCard';
import { LiveEmergencyMap } from './LiveEmergencyMap';
import {
  NearbyDoctorsHospitalsSection,
  doctorToServiceTarget,
  hospitalToServiceTarget,
} from './NearbyDoctorsHospitalsSection';
import { buildWhatsAppUrl, buildEmergencyWhatsAppMessage } from '../utils/whatsapp';
import { WhatsAppIcon } from './WhatsAppIcon';

interface MonitorViewProps {
  userRole: UserRoleMode;
  rescueConfig: RescueSystemConfig;
  contacts?: EmergencyContact[];
  autoDetectEnabled: boolean;
  onToggleAutoDetect: (enabled: boolean) => void;
  location: DetectedLocation;
  doctors: NearbyDoctor[];
  hospitals: NearbyHospital[];
  predictiveWarning: PredictiveWarning | null;
  isLoadingNearby: boolean;
  selectedPresetId: string;
  notificationPermission: NotificationPermission;
  sensorState: SmartSensorState;
  onChangeSpeed: (v: number) => void;
  onChangeGForce: (v: number) => void;
  onChangeGyroAngle: (v: number) => void;
  onChangePostSpeed: (v: number) => void;
  onEnableHardware: () => void;
  onUseSimulator: () => void;
  onEvaluateSensors: () => void;
  onSimulateFullCrash: () => void;
  onResetSensors: () => void;
  onSendPredictiveNotification: () => void;
  onSelectPreset: (id: string) => void;
  onRefreshGPS: () => void;
  onSelectTargetHospital: (hosp: NearbyHospital) => void;
  onOpenServiceCall: (svc: EmergencyService) => void;
  onOpenServiceRoute: (svc: EmergencyService) => void;
  onOpenRescueConfigModal: () => void;
  onOpenContactsTab?: () => void;
  onOpenSafetyHub?: () => void;
  onAddContact?: () => void;
  onToggleUserRole: (role: UserRoleMode) => void;
  onTriggerEmergency: () => void;
  onOpenWitnessModal: () => void;
  mapsApiKey: string;
  dispatchCase?: SmartDispatchCase | null;
  candidateTeams?: RescueTeamUnit[];
  isCoordinating?: boolean;
  onTriggerSmartDispatch?: () => void;
  onConfirmArrival?: () => void;
  onToggleTeamAvailability?: (teamId: string) => void;
  onResetDispatch?: () => void;
}

export const MonitorView: React.FC<MonitorViewProps> = ({
  userRole,
  rescueConfig,
  contacts = [],
  autoDetectEnabled,
  onToggleAutoDetect,
  location,
  doctors,
  hospitals,
  predictiveWarning,
  isLoadingNearby,
  selectedPresetId,
  notificationPermission,
  sensorState,
  onChangeSpeed,
  onChangeGForce,
  onChangeGyroAngle,
  onChangePostSpeed,
  onEnableHardware,
  onUseSimulator,
  onEvaluateSensors,
  onSimulateFullCrash,
  onResetSensors,
  onSendPredictiveNotification,
  onSelectPreset,
  onRefreshGPS,
  onSelectTargetHospital,
  onOpenServiceCall,
  onOpenServiceRoute,
  onOpenRescueConfigModal,
  onOpenContactsTab,
  onOpenSafetyHub,
  onAddContact,
  onToggleUserRole,
  onTriggerEmergency,
  onOpenWitnessModal,
  mapsApiKey,
  dispatchCase = null,
  candidateTeams = [],
  isCoordinating = false,
  onTriggerSmartDispatch,
  onConfirmArrival,
  onToggleTeamAvailability,
  onResetDispatch,
}) => {
  const [isSimulatingCrash, setIsSimulatingCrash] = useState(false);
  const [decibels, setDecibels] = useState(64.2);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHoldingSOS, setIsHoldingSOS] = useState(false);

  const gForce = sensorState.gForce;
  const speed = sensorState.speedKmh;

  // Ambient acoustic stream
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSimulatingCrash) {
        setDecibels(+(62.0 + Math.random() * 5).toFixed(1));
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isSimulatingCrash]);

  // SOS Press-and-hold trigger handler (or instant click)
  useEffect(() => {
    let holdTimer: NodeJS.Timeout;
    if (isHoldingSOS) {
      soundEffects.playEmergencyBeep();
      holdTimer = setInterval(() => {
        setHoldProgress((prev) => {
          if (prev >= 100) {
            clearInterval(holdTimer);
            setIsHoldingSOS(false);
            onTriggerEmergency();
            return 100;
          }
          return prev + 10;
        });
      }, 80);
    } else {
      setHoldProgress(0);
    }

    return () => clearInterval(holdTimer);
  }, [isHoldingSOS, onTriggerEmergency]);

  // Test crash simulation using 4-Stage Sensor Pipeline
  const handleTestCrash = () => {
    if (isSimulatingCrash) return;
    setIsSimulatingCrash(true);
    soundEffects.playEmergencyBeep();
    onSimulateFullCrash();

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([120, 60, 200]);
    }

    setTimeout(() => {
      setIsSimulatingCrash(false);
    }, 900);
  };

  return (
    <div className="flex flex-col w-full pb-6 pt-3 px-3 sm:px-6 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-300">
      {/* CAD & Connection Status Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-[#171b26] border border-[#262a35] rounded-2xl sm:rounded-full px-3.5 sm:px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4edea3]"></span>
          </span>
          <span className="text-xs text-[#dfe2f1]/90 truncate">
            Rescue 1122 CAD Sync:{' '}
            <strong className="text-[#4edea3] font-bold tracking-wide">CONNECTED</strong>
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 bg-[#262a35] px-2.5 py-0.5 rounded-full">
          <span className="material-symbols-outlined text-[14px] text-[#4edea3]">bolt</span>
          <span className="text-[11px] text-[#4edea3] font-bold font-mono-num">&lt;800ms</span>
        </div>
      </div>

      {/* Top Quick-Access Strip (1 col mobile -> 3 cols md+) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

      {/* Victim's Configured Rescue System & Nearest Hospital Route Quick-Bar */}
      <div
        onClick={() => {
          soundEffects.playHapticClick();
          onOpenRescueConfigModal();
        }}
        className="bg-[#1c1f2a] border border-[#ff334b]/40 hover:border-[#00f1fd] transition-all rounded-2xl p-2.5 flex items-center justify-between shadow-md cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#ff334b]/20 text-[#ff334b] flex items-center justify-center font-bold text-xs shrink-0 border border-[#ff334b]/40">
            <span className="material-symbols-outlined text-[18px]">emergency</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <span>#1 1122</span>
                <span className="material-symbols-outlined text-[13px] text-[#ff334b]" title="Fixed Priority 1">
                  lock
                </span>
              </span>
              <span className="text-[11px] text-[#dfe2f1]/50">•</span>
              <span className="text-xs font-semibold text-[#00f1fd] truncate">
                #2 {rescueConfig.secondarySystem.name.split(' ')[0]}
              </span>
              <span className="text-[11px] text-[#dfe2f1]/50">•</span>
              <span className="text-[11px] text-[#4edea3] truncate font-medium">
                {rescueConfig.targetHospital.name.split(' ')[0]} ({rescueConfig.targetHospital.distance})
              </span>
            </div>
            <span className="text-[10px] text-[#dfe2f1]/60 block truncate">
              {rescueConfig.forwardToAll1122Headquarters
                ? 'Control Room Coordination: 1 Nearest Suitable Team (Others Stand Down)'
                : '1122 Local PSAP 1-Team Dispatch'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 pl-1 text-[#00f1fd]">
          <span className="text-[10px] font-bold uppercase hidden sm:inline">Modify</span>
          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
            tune
          </span>
        </div>
      </div>

      {/* Emergency Contacts Lifeline Quick-Bar */}
      <div className="bg-[#1c1f2a] border border-[#262a35] hover:border-[#4edea3]/50 transition-all rounded-2xl p-2.5 flex items-center justify-between shadow-md">
        <div
          onClick={() => {
            soundEffects.playHapticClick();
            if (onOpenContactsTab) onOpenContactsTab();
          }}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 group"
        >
          <div className="w-8 h-8 rounded-xl bg-[#4edea3]/20 text-[#4edea3] flex items-center justify-center font-bold text-xs shrink-0 border border-[#4edea3]/40">
            <span className="material-symbols-outlined text-[18px]">contact_phone</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-white group-hover:text-[#4edea3] transition-colors">
                Emergency Lifelines
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#4edea3]/20 text-[#4edea3] font-bold font-mono-num">
                {contacts.filter((c) => c.enabledAlert !== false).length} Armed 🟢
              </span>
            </div>
            <span className="text-[10px] text-[#dfe2f1]/60 block truncate">
              {contacts.length > 0
                ? contacts.map((c) => c.name).slice(0, 3).join(', ') + (contacts.length > 3 ? ` +${contacts.length - 3}` : '')
                : 'No contacts configured • Tap to add parents & kin'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <a
            href={buildWhatsAppUrl(
              contacts.find((c) => c.isPrimary)?.phone || contacts[0]?.phone,
              buildEmergencyWhatsAppMessage({
                recipientName: contacts.find((c) => c.isPrimary)?.name || contacts[0]?.name,
                areaName: location.areaName,
                city: location.city,
                lat: location.lat,
                lng: location.lng,
                hospitalName: rescueConfig.targetHospital.name,
                isCrashActive: sensorState.crashDetected || isSimulatingCrash,
              })
            )}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundEffects.playHapticClick()}
            title="Contact Emergency Lifeline via WhatsApp"
            aria-label="Contact via WhatsApp"
            className="w-7 h-7 rounded-lg bg-[#25D366] text-[#002113] flex items-center justify-center shadow-sm hover:brightness-110 active:scale-95 transition-all"
          >
            <WhatsAppIcon className="w-4 h-4" />
          </a>

          {onAddContact && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playHapticClick();
                onAddContact();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#262a35] hover:bg-[#313540] text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] text-[#ff334b]">person_add</span>
              <span>Add</span>
            </button>
          )}
          {onOpenContactsTab && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playHapticClick();
                onOpenContactsTab();
              }}
              className="p-1 rounded-lg text-[#00f1fd] hover:bg-[#262a35] transition-colors"
              title="Manage Contacts"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          )}
        </div>
      </div>

      {/* Safety Hub & Roadside First-Aid Quick Banner */}
      {onOpenSafetyHub && (
        <div
          onClick={() => {
            soundEffects.playHapticClick();
            onOpenSafetyHub();
          }}
          className="group bg-gradient-to-r from-[#17202c] via-[#131b26] to-[#121622] border border-[#273447] hover:border-[#00f1fd]/50 transition-all rounded-2xl p-2.5 flex items-center justify-between shadow-md cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-[#00f1fd]/20 text-[#00f1fd] flex items-center justify-center font-bold text-xs shrink-0 border border-[#00f1fd]/40 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white group-hover:text-[#00f1fd] transition-colors">
                  Safety Hub &amp; First-Aid Blog
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#00f1fd]/20 text-[#00f1fd] font-bold">
                  NEW GUIDES
                </span>
              </div>
              <span className="text-[10px] text-[#dfe2f1]/60 block truncate">
                50Hz CAD tech • First 5 Mins First-Aid • 5 Biker Tips
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 pl-2 text-[#00f1fd]">
            <span className="text-[11px] font-bold hidden sm:inline">Explore</span>
            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </div>
        </div>
      )}
      </div>

      {/* Responsive 2-Column Command Grid (1 col < lg, 2 cols lg+) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* LEFT PANE: 3D Twin, Smart Detection Sensors & Controls */}
        <div className="lg:col-span-6 space-y-4 min-w-0">

      {/* Role Selection Check-Toggles: "I am a victim" vs "I am a witness" */}
      <div className="bg-[#171b26] border border-[#313540] rounded-2xl p-1.5 flex items-center gap-1.5 shadow-md">
        <button
          type="button"
          onClick={() => {
            soundEffects.playHapticClick();
            onToggleUserRole('victim');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            userRole === 'victim'
              ? 'bg-gradient-to-r from-[#ff334b] to-[#be0035] text-white shadow-[0_0_16px_rgba(255,51,75,0.4)]'
              : 'text-[#dfe2f1]/70 hover:text-white hover:bg-[#1c1f2a]'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">
            {userRole === 'victim' ? 'radio_button_checked' : 'radio_button_unchecked'}
          </span>
          <span>I am a Victim</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playHapticClick();
            onToggleUserRole('witness');
            onOpenWitnessModal();
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            userRole === 'witness'
              ? 'bg-[#00f1fd] text-[#00373a] shadow-[0_0_16px_rgba(0,241,253,0.35)]'
              : 'text-[#dfe2f1]/70 hover:text-white hover:bg-[#1c1f2a]'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">
            {userRole === 'witness' ? 'radio_button_checked' : 'radio_button_unchecked'}
          </span>
          <span>I am a Witness</span>
        </button>
      </div>

      {/* Mode Advisory Notice */}
      <div className="px-1 text-[11px] text-[#dfe2f1]/60 flex items-center justify-between">
        <span>
          {userRole === 'victim'
            ? '⚡ Armed: Phone IMU detects impact & broadcasts your Medical Card.'
            : '👁️ Bystander mode: Fast-report third party accidents with live GPS.'}
        </span>
        <span className="text-[#4edea3] font-mono-num font-semibold">CAD TIER-1</span>
      </div>

      {/* 3D Animated Motorcycle & Radar IMU Telemetry Scene */}
      <Farishta3DScene
        speedKmh={speed}
        gForce={gForce}
        gyroAngleDeg={sensorState.gyroAngleDeg}
        crashDetected={sensorState.crashDetected || isSimulatingCrash}
        riskLevel={predictiveWarning?.riskLevel}
        onTriggerTestCrash={handleTestCrash}
      />

      {/* 20-30 Min Predictive Hazard Warning & 4-Stage Smart Accident Detection System */}
      <SmartDetectionPanel
        sensorState={sensorState}
        predictiveWarning={predictiveWarning}
        notificationPermission={notificationPermission}
        onChangeSpeed={onChangeSpeed}
        onChangeGForce={onChangeGForce}
        onChangeGyroAngle={onChangeGyroAngle}
        onChangePostSpeed={onChangePostSpeed}
        onEnableHardware={onEnableHardware}
        onUseSimulator={onUseSimulator}
        onEvaluateNow={onEvaluateSensors}
        onSimulateFullCrash={handleTestCrash}
        onResetSensors={onResetSensors}
        onSendPredictiveNotification={onSendPredictiveNotification}
      />
        </div>

        {/* RIGHT PANE: Live Google Map & Area Doctors/Hospitals */}
        <div className="lg:col-span-6 space-y-4 min-w-0">

      {/* Interactive Google Map (Victim, Nearest Hospitals, Nearby Doctors & Route) */}
      <LiveEmergencyMap
        mapsApiKey={mapsApiKey}
        location={location}
        hospitals={hospitals}
        doctors={doctors}
        selectedHospitalId={rescueConfig.targetHospital.id}
        crashDetected={sensorState.crashDetected || isSimulatingCrash}
        onSelectTargetHospital={onSelectTargetHospital}
        onCallHospital={(hosp) => onOpenServiceCall(hospitalToServiceTarget(hosp))}
        onCallDoctor={(doc) => onOpenServiceCall(doctorToServiceTarget(doc))}
      />

      {/* Smart Dispatch & 1-Team Coordination Card */}
      {onTriggerSmartDispatch && onConfirmArrival && onToggleTeamAvailability && (
        <SmartDispatchCard
          dispatchCase={dispatchCase}
          candidateTeams={candidateTeams}
          location={location}
          contacts={contacts}
          isCoordinating={isCoordinating}
          onTriggerSmartDispatch={onTriggerSmartDispatch}
          onConfirmArrival={onConfirmArrival}
          onToggleTeamAvailability={onToggleTeamAvailability}
          onResetDispatch={onResetDispatch}
        />
      )}

      {/* Live Area Detection + Nearest Doctors & Nearest Hospitals */}
      <NearbyDoctorsHospitalsSection
        location={location}
        doctors={doctors}
        hospitals={hospitals}
        isLoading={isLoadingNearby}
        selectedPresetId={selectedPresetId}
        selectedHospitalId={rescueConfig.targetHospital.id}
        onSelectPreset={onSelectPreset}
        onRefreshGPS={onRefreshGPS}
        onSelectTargetHospital={onSelectTargetHospital}
        onCallDoctor={(doc) => onOpenServiceCall(doctorToServiceTarget(doc))}
        onRouteDoctor={(doc) => onOpenServiceRoute(doctorToServiceTarget(doc))}
        onCallHospital={(hosp) => onOpenServiceCall(hospitalToServiceTarget(hosp))}
        onRouteHospital={(hosp) => onOpenServiceRoute(hospitalToServiceTarget(hosp))}
      />
        </div>
      </div>

      {/* Bottom Dashboard Row: Telemetry Metrics + Raw Packets + Sandbox + SOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        <div className="lg:col-span-6 space-y-4 min-w-0">
      {/* Telemetry Metrics Grid (G-Force, Speed, GPS) */}
      <div className="grid grid-cols-1 gap-3">
        {/* Card 1: G-Force Dynamics & Sparkline */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#262a35] to-[#1c1f2a] border border-[#313540] p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00f1fd]" />
                <span className="text-[11px] text-[#dfe2f1]/70 uppercase tracking-wider font-semibold">
                  Lateral Dynamics
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`font-display text-3xl font-black font-mono-num transition-colors ${
                    isSimulatingCrash ? 'text-[#ff334b]' : 'text-[#00f1fd]'
                  }`}
                >
                  {gForce}
                </span>
                <span className="text-sm text-[#dfe2f1]/70 font-bold">G</span>
              </div>
              <span className="text-xs text-[#dfe2f1]/60">
                {isSimulatingCrash ? 'CRASH IMPACT SPIKE' : 'Baseline Gravity Normal'}
              </span>
            </div>

            {/* Live G-Force Waveform Mini SVG */}
            <div className="w-32 h-14 flex flex-col justify-end">
              <svg className="w-full h-10 overflow-visible" viewBox="0 0 100 40">
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00f1fd" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#00f1fd" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 30 Q 15 28, 25 31 T 50 18 T 65 32 T 75 14 T 88 28 L 100 29 L 100 40 L 0 40 Z"
                  fill="url(#waveGrad)"
                />
                <path
                  d="M 0 30 Q 15 28, 25 31 T 50 18 T 65 32 T 75 14 T 88 28 L 100 29"
                  fill="none"
                  stroke="#00f1fd"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                />
              </svg>
              <div className="flex justify-between text-[10px] text-[#dfe2f1]/50 mt-1 font-mono-num">
                <span>-5s</span>
                <span>-2.5s</span>
                <span className="text-[#00f1fd] font-bold">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Speed & GPS Split Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Speed Card */}
          <div className="rounded-2xl bg-[#1c1f2a] border border-[#262a35] p-3.5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">speed</span>
                <span className="text-[11px] text-[#dfe2f1]/70 uppercase tracking-wider font-semibold">
                  Speed
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display text-2xl font-black text-white font-mono-num">
                  {Math.round(speed)}
                </span>
                <span className="text-xs text-[#dfe2f1]/70 font-semibold">km/h</span>
              </div>
            </div>
            <div className="mt-2 pt-2 bg-[#171b26]/70 rounded-lg p-1.5 flex items-center gap-1 text-[#dfe2f1]/80">
              <span className="material-symbols-outlined text-[14px] text-[#00f1fd] shrink-0">
                navigation
              </span>
              <span className="text-[11px] truncate leading-tight">{location.areaName}</span>
            </div>
          </div>

          {/* GPS Precision Card */}
          <div className="rounded-2xl bg-[#1c1f2a] border border-[#262a35] p-3.5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#dfe2f1]/70 uppercase tracking-wider font-semibold">
                  GPS Precision
                </span>
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-1 h-1.5 bg-[#4edea3] rounded-sm"></span>
                  <span className="w-1 h-2 bg-[#4edea3] rounded-sm"></span>
                  <span className="w-1 h-3 bg-[#4edea3] rounded-sm"></span>
                  <span className="w-1 h-3 bg-[#4edea3] rounded-sm"></span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display text-2xl font-black text-[#4edea3] font-mono-num">
                  ±2.4
                </span>
                <span className="text-xs text-[#4edea3] font-bold">m</span>
              </div>
            </div>
            <div className="mt-2 pt-2 bg-[#171b26]/70 rounded-lg p-1.5 flex items-center justify-between">
              <span className="text-[10px] text-[#4edea3] font-bold uppercase">RTK Fixed</span>
              <span className="text-[10px] text-[#dfe2f1]/70 font-mono-num">18 Sats</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Crash Detection Toggle */}
      <div className="rounded-2xl bg-[#1c1f2a] border border-[#262a35] p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#4edea3]/20 flex items-center justify-center text-[#4edea3] shrink-0">
            <span className="material-symbols-outlined text-[22px]">car_crash</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-white">Auto Crash Detection</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold font-mono-num ${
                  autoDetectEnabled
                    ? 'bg-[#00a572] text-white'
                    : 'bg-[#313540] text-[#dfe2f1]/60'
                }`}
              >
                {autoDetectEnabled ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <span className="text-xs text-[#dfe2f1]/70">
              Triggers immediate 1122 dispatch upon &gt;4.5G event
            </span>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={autoDetectEnabled}
          onClick={() => {
            soundEffects.playHapticClick();
            onToggleAutoDetect(!autoDetectEnabled);
          }}
          className={`w-13 h-7 rounded-full p-0.5 transition-colors relative shrink-0 ${
            autoDetectEnabled ? 'bg-[#4edea3]' : 'bg-[#313540]'
          }`}
        >
          <span
            className={`block w-6 h-6 rounded-full bg-[#002113] shadow-md transform transition-transform ${
              autoDetectEnabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
        </div>

        <div className="lg:col-span-6 space-y-4 min-w-0">

      {/* Calibration & Test Crash Sandbox */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#262a35] via-[#1c1f2a] to-[#0a0e18] border border-[#313540] p-5 shadow-xl text-center">
        <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-[#ff334b]/20 blur-3xl pointer-events-none" />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#ff334b]">sensors</span>
            <span className="text-[11px] text-[#ff334b] font-bold uppercase tracking-wider">
              Calibration &amp; Safety Diagnostic
            </span>
          </div>

          <h3 className="font-display text-lg font-black text-white">Simulate Test Crash</h3>
          <p className="text-xs text-[#dfe2f1]/70 max-w-xs mt-1">
            Simulates an 8.2G multi-axis impact event, tests speaker acoustic alarms, and simulates CAD alert handoff.
          </p>

          {/* Test Trigger Button */}
          <div className="relative my-4 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-24 w-24 rounded-full bg-[#ff334b] opacity-35" />
            <button
              type="button"
              onClick={handleTestCrash}
              className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-[#ff334b] to-[#be0035] text-white flex flex-col items-center justify-center shadow-[0_0_30px_rgba(255,51,75,0.5)] active:scale-95 transition-all group"
            >
              <span
                className="material-symbols-outlined text-[32px] group-hover:scale-110 transition-transform"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                smart_toy
              </span>
              <span className="text-[11px] font-black tracking-wider uppercase mt-1">
                Test Trigger
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[#dfe2f1]/60 text-xs">
            <span className="material-symbols-outlined text-[14px]">info</span>
            <span>Safe Sandbox: Will test 10-second countdown flow</span>
          </div>
        </div>
      </div>

      {/* Raw Telemetry Packets Log */}
      <div className="rounded-2xl bg-[#1c1f2a] border border-[#262a35] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00f1fd]" />
            <span className="font-display text-xs font-bold text-white">Raw Telemetry Packets</span>
          </div>
          <span className="text-[10px] text-[#00f1fd] font-mono-num font-bold">SYNC: 100%</span>
        </div>

        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex flex-wrap justify-between items-center gap-1 bg-[#171b26] p-2 rounded-lg text-[#dfe2f1]/70">
            <span className="text-[#4edea3]">IMU_ACCEL_X/Y/Z</span>
            <span className="text-white font-mono-num">+0.04 / -0.01 / +{gForce}</span>
            <span className="text-[#4edea3] font-bold">STABLE</span>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-1 bg-[#171b26] p-2 rounded-lg text-[#dfe2f1]/70">
            <span className="text-[#00f1fd]">AUDIO_DECIBEL_PEAK</span>
            <span className="text-white font-mono-num">{decibels} dB</span>
            <span className="text-[#00f1fd] font-bold">CLEAR</span>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-1 bg-[#171b26] p-2 rounded-lg text-[#dfe2f1]/70">
            <span className="text-[#ffb3b5]">ROLLOVER_PITCH</span>
            <span className="text-white font-mono-num">1.4° (Threshold 65°)</span>
            <span className="text-[#4edea3] font-bold">SAFE</span>
          </div>
        </div>
      </div>

      {/* Prominent Glowing Pulsating SOS Button in Lower Thumb Zone */}
      <div className="pt-2 pb-2">
        <div className="relative w-full rounded-2xl bg-[#171b26] border border-[#ff334b]/40 p-4 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(255,51,75,0.2)]">
          <div className="flex items-center gap-2 mb-2 text-[#ffb3b5] text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px] animate-pulse">crisis_alert</span>
            <span>Emergency Thumb Action</span>
          </div>

          <div className="relative my-2 w-full flex items-center justify-center">
            {/* Outward glowing pulsation rings */}
            <span className="absolute w-44 h-16 rounded-full bg-[#ff334b]/20 animate-ping" />
            <span className="absolute w-48 h-20 rounded-full bg-[#ff334b]/10 animate-pulse" />

            {/* Glowing SOS Action Button */}
            <button
              type="button"
              onMouseDown={() => setIsHoldingSOS(true)}
              onMouseUp={() => setIsHoldingSOS(false)}
              onMouseLeave={() => setIsHoldingSOS(false)}
              onTouchStart={() => setIsHoldingSOS(true)}
              onTouchEnd={() => setIsHoldingSOS(false)}
              onClick={() => {
                soundEffects.playEmergencyBeep();
                onTriggerEmergency();
              }}
              className="relative z-10 w-full max-w-sm min-h-[64px] rounded-2xl bg-gradient-to-r from-[#ff334b] via-[#e11d48] to-[#be0035] text-white flex items-center justify-between px-4 sm:px-6 shadow-[0_0_30px_rgba(255,51,75,0.55)] active:scale-98 transition-transform cursor-pointer"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 text-left min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px] animate-pulse">
                    e911_emergency
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="font-display font-black text-base sm:text-lg tracking-wide block leading-tight">
                    SOS - REPORT ACCIDENT
                  </span>
                  <span className="text-[11px] text-white/80 font-medium block truncate">
                    {userRole === 'victim'
                      ? 'Tap or hold to trigger 10s auto-dispatch'
                      : 'Alert Rescue 1122 to nearby crash'}
                  </span>
                </div>
              </div>

              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">chevron_right</span>
              </div>
            </button>
          </div>

          {holdProgress > 0 && (
            <div className="w-full max-w-sm mt-2">
              <div className="h-1.5 w-full bg-[#262a35] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{ width: `${holdProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};
