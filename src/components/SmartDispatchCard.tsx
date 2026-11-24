import React, { useState } from 'react';
import {
  RescueTeamUnit,
  SmartDispatchCase,
  EmergencyContact,
  DetectedLocation,
} from '../types';
import { soundEffects } from '../utils/audio';
import { buildWhatsAppUrl } from '../utils/whatsapp';
import { WhatsAppIcon } from './WhatsAppIcon';

interface SmartDispatchCardProps {
  dispatchCase: SmartDispatchCase | null;
  candidateTeams: RescueTeamUnit[];
  location: DetectedLocation;
  contacts: EmergencyContact[];
  isCoordinating?: boolean;
  onTriggerSmartDispatch: () => void;
  onConfirmArrival: () => void;
  onToggleTeamAvailability: (teamId: string) => void;
  onResetDispatch?: () => void;
}

export const SmartDispatchCard: React.FC<SmartDispatchCardProps> = ({
  dispatchCase,
  candidateTeams,
  location,
  contacts,
  isCoordinating = false,
  onTriggerSmartDispatch,
  onConfirmArrival,
  onToggleTeamAvailability,
  onResetDispatch,
}) => {
  const [showOtherTeams, setShowOtherTeams] = useState(true);
  const [showPoolAvailability, setShowPoolAvailability] = useState(false);

  const availableCount = candidateTeams.filter((t) => t.availability === 'AVAILABLE').length;
  const armedContactsCount = contacts.filter((c) => c.enabledAlert !== false).length;

  return (
    <div className="rounded-2xl bg-[#1c1f2a] border border-[#00f1fd]/45 p-4 shadow-xl space-y-4 relative overflow-hidden">
      {/* Accent Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff334b] via-[#00f1fd] to-[#4edea3]" />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2.5 pt-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              dispatchCase?.arrivalConfirmed
                ? 'bg-[#4edea3]/20 border-[#4edea3]/50 text-[#4edea3]'
                : dispatchCase
                ? 'bg-[#ff334b]/20 border-[#ff334b]/50 text-[#ff5166]'
                : 'bg-[#00f1fd]/20 border-[#00f1fd]/50 text-[#00f1fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">hub</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display text-xs sm:text-sm font-black text-white">
                Smart Dispatch &amp; Team Coordination
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] text-[9px] font-black uppercase font-mono-num">
                1-TEAM LOCK
              </span>
            </div>
            <p className="text-[11px] text-[#dfe2f1]/70">
              Prevents 5-team duplication: checks location, distance &amp; availability to dispatch 1 team only.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {dispatchCase ? (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black font-mono-num border ${
                dispatchCase.arrivalConfirmed
                  ? 'bg-[#4edea3]/20 border-[#4edea3]/50 text-[#4edea3]'
                  : 'bg-[#ff334b]/20 border-[#ff334b]/50 text-[#ffb3b5] animate-pulse'
              }`}
            >
              {dispatchCase.arrivalConfirmed ? 'ARRIVED ✓' : dispatchCase.incidentId}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-[#171b26] border border-[#262a35] text-[#00f1fd] text-[10px] font-bold font-mono-num">
              {availableCount}/{candidateTeams.length} TEAMS READY
            </span>
          )}
        </div>
      </div>

      {/* Active 6-Step Coordination Pipeline */}
      {dispatchCase ? (
        <div className="space-y-3.5">
          {/* Step-by-Step Progress List (All 6 Instructions) */}
          <div className="space-y-2">
            {dispatchCase.steps.map((step) => (
              <div
                key={step.key}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                  step.completed
                    ? step.key === 'arrival_confirmed'
                      ? 'bg-[#172e25] border-[#4edea3]/50'
                      : 'bg-[#171b26] border-[#4edea3]/35'
                    : 'bg-[#1b1620] border-[#eab308]/40'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${
                    step.completed
                      ? 'bg-[#4edea3] text-[#002113]'
                      : 'bg-[#eab308]/25 border border-[#eab308]/60 text-[#fde047] animate-pulse'
                  }`}
                >
                  {step.completed ? '✓' : step.stepNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">
                      {step.stepNumber}. {step.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono-num font-bold uppercase ${
                        step.completed ? 'text-[#4edea3]' : 'text-[#fde047]'
                      }`}
                    >
                      {step.completed ? 'COMPLETED' : 'PENDING CONFIRMATION'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#dfe2f1]/75 mt-0.5 leading-snug">
                    {step.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Step 3 Highlight: The ONLY Selected & Dispatched Team */}
          <div className="rounded-2xl bg-gradient-to-br from-[#13252c] to-[#171b26] border border-[#00f1fd]/60 p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#00f1fd] block">
                  EXCLUSIVE ASSIGNED UNIT (ONLY 1 TEAM DISPATCHED)
                </span>
                <h4 className="font-display text-sm font-black text-white mt-0.5">
                  {dispatchCase.assignedTeam.name}
                </h4>
                <span className="text-[11px] text-[#dfe2f1]/75 block">
                  {dispatchCase.assignedTeam.unitType} • Control Room: {dispatchCase.controlRoomName}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-[#4edea3] font-mono-num block">
                  {dispatchCase.assignedTeam.distance}
                </span>
                <span className="text-xs font-black text-[#00f1fd] font-mono-num block">
                  {dispatchCase.arrivalConfirmed ? 'ON SCENE' : `${dispatchCase.assignedTeam.eta} ETA`}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {dispatchCase.assignedTeam.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-[#0a0e18] border border-[#262a35] text-[#dfe2f1]/85"
                >
                  {cap}
                </span>
              ))}
            </div>

            {/* Step 6: Interactive Arrival Confirmation Control */}
            <div className="pt-2 border-t border-[#262a35] flex flex-wrap items-center justify-between gap-2">
              {dispatchCase.arrivalConfirmed ? (
                <div className="flex items-center gap-2 text-xs font-bold text-[#4edea3]">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>
                    Arrival Confirmed — Team On Scene &amp; Family Updated
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playSuccessDispatch();
                    onConfirmArrival();
                  }}
                  className="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#4edea3] text-[#002113] font-display font-black text-xs flex items-center justify-center gap-1.5 shadow-[0_0_16px_rgba(78,222,163,0.35)] active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[17px]">where_to_vote</span>
                  <span>Confirm Team Arrival on Scene</span>
                </button>
              )}

              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${dispatchCase.assignedTeam.phone}`}
                  onClick={() => soundEffects.playHapticClick()}
                  className="min-h-[40px] px-3 rounded-xl bg-[#262a35] hover:bg-[#313540] text-white text-xs font-bold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#00f1fd]">call</span>
                  <span>Call</span>
                </a>
                <a
                  href={buildWhatsAppUrl(
                    dispatchCase.assignedTeam.phone,
                    dispatchCase.assignedTeam.notificationMessage ||
                      `FARISHTA Case ${dispatchCase.incidentId}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => soundEffects.playHapticClick()}
                  className="min-h-[40px] px-3 rounded-xl bg-[#25D366] text-[#002113] text-xs font-black flex items-center gap-1"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                {onResetDispatch && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playHapticClick();
                      onResetDispatch();
                    }}
                    className="min-h-[40px] px-2.5 rounded-xl bg-[#171b26] border border-[#313540] text-[#dfe2f1]/70 hover:text-white text-[11px] font-semibold"
                    title="Reset Dispatch Case"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 4: Other Teams Notified (Exact Stand-Down Message) */}
          <div className="rounded-2xl bg-[#171b26] border border-[#262a35] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#ffb3b5]">
                  notifications_paused
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                  Other Teams Notified ({dispatchCase.otherTeams.length} Stood Down)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOtherTeams((v) => !v)}
                className="text-[10px] font-bold text-[#00f1fd] hover:underline"
              >
                {showOtherTeams ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0e121d] border border-[#313540] text-[11px] text-[#dfe2f1]/90 italic">
              &ldquo;{dispatchCase.standDownMessage}&rdquo;
            </div>

            {showOtherTeams && (
              <div className="space-y-1.5 pt-1">
                {dispatchCase.otherTeams.map((team) => (
                  <div
                    key={team.id}
                    className="p-2 rounded-xl bg-[#121622] border border-[#262a35] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-white/90 block truncate">
                        {team.name}
                      </span>
                      <span className="text-[10px] text-[#dfe2f1]/55 block truncate">
                        {team.distance} • {team.controlRoom}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black shrink-0 ${
                        team.dispatchStatus === 'BUSY_SKIPPED'
                          ? 'bg-[#eab308]/20 text-[#fde047]'
                          : 'bg-[#262a35] text-[#dfe2f1]/70'
                      }`}
                    >
                      {team.dispatchStatus === 'BUSY_SKIPPED' ? 'BUSY • SKIPPED' : 'STOOD DOWN'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 5: Family Notification Panel */}
          <div className="rounded-2xl bg-[#171b26] border border-[#4edea3]/30 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">
                  family_restroom
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                  Family Notification ({dispatchCase.familyNotifications.length} Contacts)
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#4edea3]">
                {dispatchCase.arrivalConfirmed ? 'ARRIVAL SENT ✓' : 'DISPATCH SENT ✓'}
              </span>
            </div>

            {dispatchCase.familyNotifications.length === 0 ? (
              <p className="text-[11px] text-[#dfe2f1]/65">
                Add saved family contacts in the Contacts tab to auto-notify them of the dispatched team &amp; arrival.
              </p>
            ) : (
              <div className="space-y-2">
                {dispatchCase.familyNotifications.map((fam) => (
                  <div
                    key={fam.contactId}
                    className="p-2.5 rounded-xl bg-[#121622] border border-[#262a35] flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white">{fam.name}</span>
                        <span className="text-[10px] text-[#dfe2f1]/60">({fam.relation})</span>
                      </div>
                      <p className="text-[10px] text-[#dfe2f1]/80 mt-0.5 leading-snug">
                        {fam.message}
                      </p>
                    </div>
                    <a
                      href={buildWhatsAppUrl(fam.phone, fam.message)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => soundEffects.playHapticClick()}
                      title={`Send Dispatch Update on WhatsApp to ${fam.name}`}
                      className="w-8 h-8 rounded-full bg-[#25D366] text-[#002113] flex items-center justify-center shrink-0 hover:brightness-110 active:scale-95 transition-transform"
                    >
                      <WhatsAppIcon className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Standby Mode: Preview Live Teams Availability + Single-Team Coordination Trigger */
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
            <div className="p-2.5 rounded-xl bg-[#171b26] border border-[#262a35]">
              <span className="text-[#dfe2f1]/60 uppercase block font-semibold">Detected Area</span>
              <span className="text-white font-bold block truncate mt-0.5">
                {location.areaName}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#171b26] border border-[#262a35]">
              <span className="text-[#dfe2f1]/60 uppercase block font-semibold">Available Units</span>
              <span className="text-[#4edea3] font-black font-mono-num block mt-0.5">
                {availableCount} Available / {candidateTeams.length - availableCount} Busy
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-[#171b26] border border-[#262a35]">
              <span className="text-[#dfe2f1]/60 uppercase block font-semibold">Family Lifelines</span>
              <span className="text-[#00f1fd] font-black font-mono-num block mt-0.5">
                {armedContactsCount} Armed Contacts
              </span>
            </div>
          </div>

          {/* Toggle Team Availability Simulation List */}
          <div className="rounded-xl bg-[#171b26] border border-[#262a35] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white">
                Nearby Emergency Fleet Pool (Location, Distance &amp; Availability)
              </span>
              <button
                type="button"
                onClick={() => setShowPoolAvailability((v) => !v)}
                className="text-[10px] font-bold text-[#00f1fd] hover:underline shrink-0"
              >
                {showPoolAvailability ? 'Hide Pool' : 'Manage Availability'}
              </button>
            </div>

            {showPoolAvailability ? (
              <div className="space-y-1.5 pt-1">
                {candidateTeams.map((team) => {
                  const isAvailable = team.availability === 'AVAILABLE';
                  return (
                    <div
                      key={team.id}
                      className="p-2 rounded-xl bg-[#121622] border border-[#262a35] flex items-center justify-between gap-2 flex-wrap"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-white block truncate">
                          {team.name}
                        </span>
                        <span className="text-[10px] text-[#dfe2f1]/60 block">
                          {team.distance} • {team.eta} ETA • {team.unitType}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playHapticClick();
                          onToggleTeamAvailability(team.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors shrink-0 ${
                          isAvailable
                            ? 'bg-[#4edea3]/20 border border-[#4edea3]/40 text-[#4edea3]'
                            : 'bg-[#eab308]/20 border border-[#eab308]/40 text-[#fde047]'
                        }`}
                      >
                        {isAvailable ? 'AVAILABLE (Tap to Busy)' : 'BUSY (Tap to Free)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-[#dfe2f1]/65">
                On accident detection, FARISHTA assigns the single best available unit and sends stand-down notices to all remaining teams automatically.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={isCoordinating}
            onClick={() => {
              soundEffects.playEmergencyBeep();
              onTriggerSmartDispatch();
            }}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#ff334b] to-[#be0035] text-white font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(255,51,75,0.4)] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">route</span>
            <span>
              {isCoordinating
                ? 'Coordinating Nearest Available Team...'
                : 'Test Smart Dispatch (Assign 1 Team & Stand Down Others)'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
