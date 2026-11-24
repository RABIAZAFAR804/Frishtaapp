import React, { useState, useEffect, useRef } from 'react';
import { SlideToCancel } from './SlideToCancel';
import {
  RescueSystemConfig,
  EmergencyContact,
  DetectedLocation,
  RescueTeamUnit,
} from '../types';
import { soundEffects } from '../utils/audio';
import { buildWhatsAppUrl, buildEmergencyWhatsAppMessage } from '../utils/whatsapp';
import { WhatsAppIcon } from './WhatsAppIcon';

interface EmergencyViewProps {
  rescueConfig?: RescueSystemConfig;
  contacts?: EmergencyContact[];
  location?: DetectedLocation;
  candidateTeams?: RescueTeamUnit[];
  gForce?: number;
  speedKmh?: number;
  onCancelEmergency: () => void;
  onDispatchConfirmed: () => void;
  isAudioMuted: boolean;
}

export const EmergencyView: React.FC<EmergencyViewProps> = ({
  rescueConfig,
  contacts = [],
  location,
  candidateTeams = [],
  gForce = 5.8,
  speedKmh = 48,
  onCancelEmergency,
  onDispatchConfirmed,
  isAudioMuted,
}) => {
  const [timeLeft, setTimeLeft] = useState(10);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isDispatched, setIsDispatched] = useState(false);
  const maxTime = 10;
  const perimeter = 628.3; // 2 * PI * 100
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // SVG ring stroke offset
  const progressFraction = timeLeft / maxTime;
  const strokeOffset = perimeter - progressFraction * perimeter;

  const reportToLocalApi = () => {
    fetch('/api/v1/crash/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: location?.lat ?? 31.5204,
        lng: location?.lng ?? 74.3587,
        gForce,
        speedKmh,
      }),
    }).catch(() => {});
  };

  // Countdown clock & acoustic pings
  useEffect(() => {
    if (isCancelled || isDispatched) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setIsDispatched(true);
          soundEffects.playSuccessDispatch();
          reportToLocalApi();
          setTimeout(() => {
            onDispatchConfirmed();
          }, 1000);
          return 0;
        }

        // Play warning ping if unmuted
        if (!isAudioMuted) {
          soundEffects.playEmergencyBeep();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isCancelled, isDispatched, isAudioMuted, onDispatchConfirmed]);

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsCancelled(true);
    soundEffects.playHapticClick();
    fetch('/api/v1/crash/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: location?.lat ?? 31.5204,
        lng: location?.lng ?? 74.3587,
      }),
    }).catch(() => {});
    setTimeout(() => {
      onCancelEmergency();
    }, 1400);
  };

  const handleInstantDispatch = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeLeft(0);
    setIsDispatched(true);
    soundEffects.playSuccessDispatch();
    reportToLocalApi();
    setTimeout(() => {
      onDispatchConfirmed();
    }, 800);
  };

  const targetContacts = contacts.filter((c) => c.enabledAlert !== false);
  const availableTeams = candidateTeams
    .filter((t) => t.availability === 'AVAILABLE')
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore || a.distanceKm - b.distanceKm);
  const selectedTeam = availableTeams[0] || candidateTeams[0];
  const otherTeamsCount = Math.max(0, candidateTeams.length - (selectedTeam ? 1 : 0));

  return (
    <div className="flex flex-col w-full pb-6 pt-1 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Acoustic Pulsing Warning Bar */}
      <div className="w-full bg-[#93000a] text-[#ffdad6] px-3 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 shadow-lg border-b border-[#ff334b]/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[20px] animate-pulse text-white shrink-0">
            volume_up
          </span>
          <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-extrabold font-mono-num truncate">
            ALARM PULSE ACTIVE • LOUD ACOUSTIC PING
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-3.5 bg-white rounded-full animate-bounce" />
          <span className="w-1.5 h-5 bg-white rounded-full animate-bounce [animation-delay:0.15s]" />
          <span className="w-1.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:0.3s]" />
        </div>
      </div>

      <div className="px-3 sm:px-6 pt-3 flex flex-col gap-4">
        {/* Top Tactical Alert Strip */}
        <div className="bg-[#262a35] border border-[#ff334b]/50 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#ff334b]/20 via-transparent to-transparent pointer-events-none" />
          <div className="flex items-start justify-between flex-wrap gap-3 relative z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#ff334b] text-white flex items-center justify-center shadow-[0_0_18px_rgba(255,51,75,0.7)] shrink-0">
                <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-black text-base text-white">
                    CRASH INGESTION
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#ff334b] text-white text-[10px] font-extrabold uppercase tracking-wider">
                    CRITICAL
                  </span>
                </div>
                <p className="text-[11px] text-[#dfe2f1]/70 font-mono-num mt-0.5 truncate">
                  POST /api/v1/crash/report • ID #CR-88219
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-[#4edea3] uppercase tracking-wider font-bold flex items-center gap-1 justify-end">
                <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-ping" /> Live HUD
              </span>
              <span className="text-[11px] text-[#dfe2f1]/70 font-mono-num font-semibold">
                50Hz G-FORCE GYRO
              </span>
            </div>
          </div>
        </div>

        {/* Desktop 2-Column Emergency HUD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          {/* LEFT PANE: Countdown Ring, Tactile Slide & Controls */}
          <div className="lg:col-span-6 space-y-4 min-w-0">

        {/* Center Stage: Circular Progress Countdown */}
        <div className="relative flex flex-col items-center justify-center py-6 bg-[#0a0e18] border border-[#313540] rounded-3xl shadow-2xl overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute w-60 h-60 rounded-full bg-[#ff334b]/15 blur-3xl pointer-events-none -top-10" />
          <div className="absolute w-52 h-52 rounded-full bg-[#00f1fd]/10 blur-2xl pointer-events-none bottom-0" />

          {/* Telemetry G-Force Chip */}
          <div className="relative z-10 mb-3 px-3.5 py-1 rounded-full bg-[#1c1f2a] border border-[#313540] text-white flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-[16px] text-[#ff334b]">speed</span>
            <span className="text-xs font-black tracking-tight text-[#ff334b] font-mono-num">
              5.8G SEVERE IMPACT DETECTED
            </span>
          </div>

          {/* SVG Ring & Countdown Display */}
          <div className="relative w-52 h-52 sm:w-64 sm:h-64 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 240 240">
              {/* Background ring */}
              <circle
                className="text-[#1c1f2a]"
                cx="120"
                cy="120"
                r="100"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="12"
              />
              {/* Active countdown stroke */}
              <circle
                className={`transition-all duration-1000 ease-linear ${
                  isCancelled ? 'text-[#4edea3]' : isDispatched ? 'text-[#00f1fd]' : 'text-[#ff334b]'
                }`}
                cx="120"
                cy="120"
                r="100"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="14"
                strokeDasharray="628.3"
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{
                  filter: isCancelled
                    ? 'drop-shadow(0 0 12px rgba(78,222,163,0.7))'
                    : 'drop-shadow(0 0 16px rgba(255,51,75,0.8))',
                }}
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute flex flex-col items-center justify-center text-center px-4">
              <span
                className={`font-display text-5xl font-black tracking-tighter font-mono-num ${
                  isCancelled
                    ? 'text-[#4edea3]'
                    : isDispatched
                    ? 'text-[#00f1fd]'
                    : 'text-[#ff334b] drop-shadow-[0_0_24px_rgba(255,51,75,0.7)]'
                }`}
              >
                {isCancelled ? 'ABORT' : isDispatched ? 'CAD OK' : `${timeLeft < 10 ? '0' : ''}${timeLeft}s`}
              </span>

              <span className="text-xs font-bold uppercase tracking-widest text-[#dfe2f1] mt-0.5">
                {isCancelled
                  ? 'DISPATCH CANCELLED'
                  : isDispatched
                  ? 'AUTONOMOUS CAD ACTIVE'
                  : 'REMAINING'}
              </span>

              <div className="mt-2.5 flex items-center gap-1.5 text-[#dfe2f1]/80 text-[11px] font-mono-num bg-[#171b26] border border-[#313540] px-2.5 py-1 rounded-lg">
                <span className="material-symbols-outlined text-[14px] text-[#4edea3]">
                  location_on
                </span>
                <span>
                  {(location?.lat ?? 31.521).toFixed(4)}° N, {(location?.lng ?? 74.3485).toFixed(4)}° E
                </span>
              </div>
            </div>
          </div>

          {/* Subtext info */}
          <div className="relative z-10 mt-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171b26] border border-[#313540] text-[#dfe2f1]/80 text-xs">
              <span className="material-symbols-outlined text-[15px] text-[#ff334b]">info</span>
              <span>False Alarm? Use tactile slider below to abort</span>
            </div>
          </div>
        </div>

        {/* Heavy-Duty Slide to Cancel Component */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#dfe2f1]/70 px-1">
            Tactile Cancellation Action
          </label>
          <SlideToCancel onCancel={handleCancel} isCancelled={isCancelled} />
        </div>

        {/* Direct Action Controls */}
        <div className="flex flex-col gap-2.5">
          {/* Green Quick Abort Button */}
          <button
            type="button"
            disabled={isCancelled || isDispatched}
            onClick={handleCancel}
            className={`w-full min-h-[56px] rounded-2xl flex items-center justify-between px-4 transition-all border ${
              isCancelled
                ? 'bg-[#172e25] border-[#4edea3] text-[#4edea3] opacity-80'
                : 'bg-[#00a572] hover:bg-[#4edea3] text-[#002113] border-[#4edea3]/40 shadow-[0_4px_20px_rgba(0,165,114,0.35)] active:scale-98'
            }`}
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">thumb_up</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-sm">
                  {isCancelled ? 'CANCELLED CONFIRMED' : 'I AM OKAY — CANCEL'}
                </span>
                <span className="text-[10px] opacity-80 font-mono-num">
                  POST /api/v1/crash/cancel
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
              <span>ABORT</span>
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </div>
          </button>

          {/* Immediate Dispatch Button */}
          <button
            type="button"
            disabled={isCancelled || isDispatched}
            onClick={handleInstantDispatch}
            className="w-full min-h-[52px] bg-gradient-to-r from-[#ff334b] via-[#e11d48] to-[#be0035] text-white rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,51,75,0.4)] active:scale-98 transition-all hover:shadow-[0_0_30px_rgba(255,51,75,0.6)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px] animate-pulse">send</span>
            <span className="font-display font-black text-xs sm:text-sm uppercase tracking-wide text-center px-2">
              DISPATCH NOW IMMEDIATELY (BYPASS)
            </span>
          </button>
        </div>
          </div>

          {/* RIGHT PANE: Targeted Contacts + CAD Pipeline + Hardware */}
          <div className="lg:col-span-6 space-y-4 min-w-0">

        {/* Emergency Contacts Targeted for Dispatch Card */}
        <div className="bg-[#1c1f2a] border border-[#ff334b]/40 rounded-2xl p-4 shadow-xl flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-[#262a35]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#ff334b]">
                notifications_active
              </span>
              <div>
                <h4 className="font-display text-xs font-black text-white uppercase tracking-wider">
                  Contacts Receiving Accident Alert
                </h4>
                <p className="text-[10px] text-[#dfe2f1]/60">
                  Live GPS accident pin dispatched automatically after 10 seconds
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#4edea3]/20 border border-[#4edea3]/40 text-[#4edea3] text-[10px] font-bold font-mono-num">
              {targetContacts.length} ACTIVE
            </span>
          </div>

          <div className="space-y-2">
            {targetContacts.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#dfe2f1]/60">
                No emergency contacts enabled.
              </div>
            ) : (
              targetContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    isDispatched
                      ? 'bg-[#172e25] border-[#4edea3]/40 text-white'
                      : isCancelled
                      ? 'bg-[#171b26] border-[#262a35] text-[#dfe2f1]/50'
                      : 'bg-[#171b26] border-[#313540] text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#ff334b]/20 border border-[#ff334b]/40 text-[#ff334b] font-bold text-xs flex items-center justify-center shrink-0">
                      {contact.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{contact.name}</span>
                        <span className="text-[10px] text-[#dfe2f1]/60">({contact.relation})</span>
                        {contact.isPrimary && (
                          <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#ff334b]/20 text-[#ffb3b5] font-bold">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#00f1fd] font-mono-num block">
                        {contact.phone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={buildWhatsAppUrl(
                        contact.phone,
                        buildEmergencyWhatsAppMessage({
                          recipientName: contact.name,
                          areaName: location?.areaName,
                          city: location?.city,
                          lat: location?.lat,
                          lng: location?.lng,
                          hospitalName: rescueConfig?.targetHospital.name,
                          isCrashActive: true,
                        })
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => soundEffects.playHapticClick()}
                      title={`Send crash GPS via WhatsApp to ${contact.name}`}
                      className="w-7 h-7 rounded-full bg-[#25D366] text-[#002113] flex items-center justify-center shadow-sm hover:brightness-110 active:scale-95 transition-transform"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                    </a>

                    <div className="text-right">
                      {isDispatched ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4edea3]">
                          <span>SMS SENT 🟢</span>
                        </span>
                      ) : isCancelled ? (
                        <span className="text-[10px] font-bold text-[#dfe2f1]/40">
                          ABORTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eab308]/20 border border-[#eab308]/40 text-[#fde047] text-[10px] font-bold font-mono-num animate-pulse">
                          <span>Dispatch in {timeLeft}s</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* SMS Payload Display + Quick WhatsApp Broadcast */}
          <div className="p-2.5 rounded-xl bg-[#121622] border border-[#262a35] text-[10px] font-mono text-[#dfe2f1]/80 leading-relaxed space-y-2">
            <div>
              <span className="text-[#00f1fd] font-bold block mb-0.5">DISPATCH SMS PAYLOAD:</span>
              &ldquo;🚨 FARISHTA ACCIDENT: Bike impact at {(location?.lat ?? 31.521).toFixed(4)}° N, {(location?.lng ?? 74.3485).toFixed(4)}° E. Rescue 1122 active. Live tracking: https://farishta.app/track/CR-88219&rdquo;
            </div>
            <a
              href={buildWhatsAppUrl(
                targetContacts[0]?.phone,
                buildEmergencyWhatsAppMessage({
                  recipientName: targetContacts[0]?.name,
                  areaName: location?.areaName,
                  city: location?.city,
                  lat: location?.lat,
                  lng: location?.lng,
                  hospitalName: rescueConfig?.targetHospital.name,
                  isCrashActive: true,
                })
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => soundEffects.playHapticClick()}
              className="w-full py-2 px-3 rounded-xl bg-[#25D366] text-[#002113] font-display font-black text-xs flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>Send Live Crash GPS via WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Smart Dispatch & Single-Team Coordination Pipeline */}
        <div className="bg-[#1c1f2a] border border-[#262a35] rounded-2xl p-4 shadow-md flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#262a35]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#00f1fd]">hub</span>
              <span className="font-display text-xs font-bold text-white uppercase tracking-wider">
                Smart Dispatch &amp; Team Coordination
              </span>
            </div>
            <span className="text-[10px] font-mono-num text-[#4edea3] font-bold">
              1-TEAM EXCLUSIVE LOCK
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Step 1: Accident Detected */}
            <div
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                isCancelled
                  ? 'bg-[#171b26] border-[#313540] text-[#dfe2f1]/60'
                  : 'bg-[#262a35] border-[#ff334b]/40 text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff334b] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff334b]"></span>
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold">
                    {isCancelled ? '1. [Aborted] Accident Alert Cancelled' : '1. Accident Detected • Alert Generated'}
                  </span>
                  <span className="text-[10px] text-[#dfe2f1]/60 font-mono-num truncate">
                    {isCancelled
                      ? 'Rider confirmed safety within 10s buffer'
                      : `${location?.areaName || 'GPS Locked'} (${gForce.toFixed(1)}G impact)`}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#ff334b]/20 text-[#ffb3b5] text-[10px] font-bold font-mono-num shrink-0">
                {isCancelled ? 'ABORTED' : `T-${timeLeft < 10 ? '0' : ''}${timeLeft}s`}
              </span>
            </div>

            {/* Step 2: Nearby Emergency Services Notified (Single Case Lock) */}
            <div
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                isDispatched
                  ? 'bg-[#172e25] border-[#4edea3]/40 text-white'
                  : 'bg-[#171b26] border-[#262a35] text-[#dfe2f1]/70'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isDispatched ? 'bg-[#4edea3]' : 'bg-[#00f1fd]'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <span>2. Nearby Emergency Control Room Notified</span>
                    <span className="material-symbols-outlined text-[12px] text-[#00f1fd]">lock</span>
                  </span>
                  <span className="text-[10px] text-[#dfe2f1]/55">
                    Case locked to 1 selected team only (no multi-team duplication)
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#262a35] text-[10px] font-mono-num font-bold shrink-0">
                {isDispatched ? 'LOCKED' : '1-TEAM RULE'}
              </span>
            </div>

            {/* Step 3: Nearest Suitable Team Dispatched */}
            <div
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                isDispatched
                  ? 'bg-[#172e25] border-[#4edea3]/40 text-white'
                  : 'bg-[#171b26] border-[#262a35] text-[#dfe2f1]/70'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isDispatched ? 'bg-[#00f1fd]' : 'bg-[#313540]'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold truncate">
                    3. {isDispatched ? '✓ Nearest Suitable Team Dispatched' : 'Select Nearest Suitable Team'}
                  </span>
                  <span className="text-[10px] text-[#dfe2f1]/55 truncate">
                    {selectedTeam
                      ? `${selectedTeam.name} (${selectedTeam.distance}, ${selectedTeam.eta} ETA • Available)`
                      : 'Evaluating team location, distance & availability'}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#262a35] text-[10px] font-mono-num shrink-0">
                {isDispatched ? 'DISPATCHED' : selectedTeam?.eta || 'READY'}
              </span>
            </div>

            {/* Step 4: Other Teams Notified (Stand-Down Notice) */}
            <div
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                isDispatched
                  ? 'bg-[#172e25] border-[#4edea3]/40 text-white'
                  : 'bg-[#171b26] border-[#262a35] text-[#dfe2f1]/70'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isDispatched ? 'bg-[#4edea3]' : 'bg-[#313540]'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold">
                    4. Other Teams Notified ({otherTeamsCount} Stood Down)
                  </span>
                  <span className="text-[10px] text-[#dfe2f1]/55">
                    &ldquo;This emergency has already been assigned to another team. No additional response is required at this time.&rdquo;
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#262a35] text-[10px] font-mono-num shrink-0">
                {isDispatched ? 'STOOD DOWN' : 'AUTO'}
              </span>
            </div>

            {/* Step 5: Family Notification */}
            <div
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                isDispatched
                  ? 'bg-[#172e25] border-[#4edea3]/40 text-white'
                  : 'bg-[#171b26] border-[#262a35] text-[#dfe2f1]/70'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isDispatched ? 'bg-[#4edea3]' : 'bg-[#313540]'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold">
                    5. {isDispatched
                      ? `✓ Family Notified (${targetContacts.length} Contacts)`
                      : `Family Notification (${targetContacts.length} Contacts)`}
                  </span>
                  <span className="text-[10px] text-[#dfe2f1]/55 truncate">
                    Alerts saved contacts that {selectedTeam?.agency || 'Rescue'} team is dispatched
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#262a35] text-[10px] font-mono-num shrink-0">
                {isDispatched ? 'DELIVERED' : `T-${timeLeft}s`}
              </span>
            </div>

            {/* Step 6: Arrival Confirmation */}
            <div
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                isDispatched
                  ? 'bg-[#171b26] border-[#00f1fd]/40 text-white'
                  : 'bg-[#171b26] border-[#262a35] text-[#dfe2f1]/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isDispatched ? 'bg-[#00f1fd] animate-pulse' : 'bg-[#313540]'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold truncate">
                    6. Arrival Confirmation &rarr; {rescueConfig?.targetHospital.name || 'Target ER'}
                  </span>
                  <span className="text-[10px] text-[#dfe2f1]/55">
                    Confirms on-scene arrival on Radar HUD &amp; updates family
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#262a35] text-[10px] font-mono-num font-bold shrink-0">
                {isDispatched ? 'TRACKING' : 'STEP 6'}
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry Hardware Diagnostics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
          <div className="bg-[#171b26] border border-[#262a35] p-3 rounded-2xl flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#4edea3]">
              battery_charging_full
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#dfe2f1]/60 font-semibold">VEHICLE POWER</span>
              <span className="text-xs font-bold text-white font-mono-num">13.8V Stable</span>
            </div>
          </div>

          <div className="bg-[#171b26] border border-[#262a35] p-3 rounded-2xl flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#00f1fd]">
              satellite_alt
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#dfe2f1]/60 font-semibold">GNSS PRECISION</span>
              <span className="text-xs font-bold text-white font-mono-num">± 1.4m CEP</span>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};
