import React from 'react';
import { motion } from 'motion/react';
import { PredictiveWarning, SmartSensorState } from '../types';
import { soundEffects } from '../utils/audio';

interface SmartDetectionPanelProps {
  sensorState: SmartSensorState;
  predictiveWarning: PredictiveWarning | null;
  notificationPermission: NotificationPermission;
  onChangeSpeed: (v: number) => void;
  onChangeGForce: (v: number) => void;
  onChangeGyroAngle: (v: number) => void;
  onChangePostSpeed: (v: number) => void;
  onEnableHardware: () => void;
  onUseSimulator: () => void;
  onEvaluateNow: () => void;
  onSimulateFullCrash: () => void;
  onResetSensors: () => void;
  onSendPredictiveNotification: () => void;
}

export const SmartDetectionPanel: React.FC<SmartDetectionPanelProps> = ({
  sensorState,
  predictiveWarning,
  notificationPermission,
  onChangeSpeed,
  onChangeGForce,
  onChangeGyroAngle,
  onChangePostSpeed,
  onEnableHardware,
  onUseSimulator,
  onEvaluateNow,
  onSimulateFullCrash,
  onResetSensors,
  onSendPredictiveNotification,
}) => {
  const { stages } = sensorState;

  const stageCards = [
    {
      id: 'speed',
      step: '01',
      title: 'Speed Check',
      subtitle: 'GPS checks if person is on bike/vehicle',
      active: stages.speedCheck.passed,
      statusText: stages.speedCheck.label,
      metric: `${Math.round(stages.speedCheck.speedKmh)} km/h`,
      detail: stages.speedCheck.detail,
      icon: 'speed',
      activeColor: '#4edea3',
    },
    {
      id: 'impact',
      step: '02',
      title: 'Sudden Impact',
      subtitle: 'Accelerometer detects strong shock',
      active: stages.suddenImpact.triggered,
      statusText: stages.suddenImpact.label,
      metric: `${stages.suddenImpact.gForce.toFixed(2)} G`,
      detail: stages.suddenImpact.detail,
      icon: 'flash_on',
      activeColor: '#ff334b',
    },
    {
      id: 'direction',
      step: '03',
      title: 'Direction Change',
      subtitle: 'Gyroscope detects sudden fall / rotation',
      active: stages.directionChange.triggered,
      statusText: stages.directionChange.label,
      metric: `${Math.abs(stages.directionChange.angleDeg)}°`,
      detail: stages.directionChange.detail,
      icon: 'screen_rotation',
      activeColor: '#f59e0b',
    },
    {
      id: 'movement',
      step: '04',
      title: 'Movement Check',
      subtitle: 'GPS checks sudden stop after impact',
      active: stages.movementCheck.triggered,
      statusText: stages.movementCheck.label,
      metric: `${Math.round(stages.movementCheck.postImpactSpeedKmh)} km/h`,
      detail: stages.movementCheck.detail,
      icon: 'wrong_location',
      activeColor: '#ff334b',
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* 20-30 Minute Early Predictive Accident Warning & Notification Card */}
      {predictiveWarning && (
        <motion.div
          initial={{ opacity: 0, y: 12, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.35 }}
          style={{ transformPerspective: 900 }}
          className={`rounded-2xl border p-4 shadow-xl relative overflow-hidden ${
            predictiveWarning.riskLevel === 'high' || predictiveWarning.riskLevel === 'critical'
              ? 'bg-gradient-to-br from-[#2b1a12] via-[#1c1f2a] to-[#171b26] border-[#f59e0b]/60'
              : 'bg-gradient-to-br from-[#13222b] via-[#1c1f2a] to-[#171b26] border-[#00f1fd]/45'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#fbbf24] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">notifications_active</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-[#f59e0b]/20 text-[#fbbf24] text-[10px] font-black uppercase tracking-wider font-mono-num">
                    {predictiveWarning.leadTimeMinutes} MIN EARLY WARNING (20–30M)
                  </span>
                  <span className="text-[10px] text-[#00f1fd] font-semibold">
                    Max Safe: {predictiveWarning.recommendedMaxSpeedKmh} km/h
                  </span>
                </div>
                <h3 className="font-display text-sm font-black text-white mt-1">
                  {predictiveWarning.title}
                </h3>
                <p className="text-xs text-[#dfe2f1]/80 mt-0.5 leading-relaxed">
                  {predictiveWarning.message}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#313540]/70 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] text-[#dfe2f1]/60 font-mono-num">
              Zone: {predictiveWarning.zoneName}
            </span>
            <button
              type="button"
              onClick={() => {
                soundEffects.playHapticClick();
                onSendPredictiveNotification();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] text-[#1c1000] text-[11px] font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">notification_add</span>
              <span>
                {notificationPermission === 'granted'
                  ? 'Push 20-30m Alert Now'
                  : 'Enable & Test Alert Notification'}
              </span>
            </button>
          </div>
        </motion.div>
      )}

      {/* FARISHTA 4-Stage Smart Accident Detection System */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl bg-[#1c1f2a] border border-[#313540] p-4 shadow-xl space-y-3"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#00f1fd]">
                radar
              </span>
              <h3 className="font-display text-sm font-black text-white">
                FARISHTA Smart Accident Detection System
              </h3>
            </div>
            <p className="text-[11px] text-[#dfe2f1]/65 mt-0.5">
              4-Stage Sensor Pipeline • Local API Telemetry Analysis
            </p>
          </div>

          {/* Sensor Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#171b26] p-1 rounded-xl border border-[#262a35]">
            <button
              type="button"
              onClick={() => {
                soundEffects.playHapticClick();
                onUseSimulator();
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                sensorState.sensorSource === 'simulator'
                  ? 'bg-[#00f1fd] text-[#00373a]'
                  : 'text-[#dfe2f1]/70 hover:text-white'
              }`}
            >
              Simulator
            </button>
            <button
              type="button"
              onClick={() => {
                soundEffects.playHapticClick();
                onEnableHardware();
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                sensorState.sensorSource === 'hardware'
                  ? 'bg-[#4edea3] text-[#002113]'
                  : 'text-[#dfe2f1]/70 hover:text-white'
              }`}
            >
              Live IMU/GPS
            </button>
          </div>
        </div>

        {/* 4 Stage Cards in 3D Perspective Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {stageCards.map((stage) => (
            <motion.div
              key={stage.id}
              whileHover={{ y: -2, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className={`rounded-xl p-3 border transition-colors ${
                stage.active
                  ? 'bg-[#171b26] border-opacity-70 shadow-lg'
                  : 'bg-[#141822] border-[#262a35]'
              }`}
              style={{
                borderColor: stage.active ? stage.activeColor : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${stage.activeColor}20`,
                      color: stage.activeColor,
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">{stage.icon}</span>
                  </span>
                  <div>
                    <span className="text-[10px] font-mono-num text-[#dfe2f1]/50 block leading-none">
                      STAGE {stage.step}
                    </span>
                    <span className="text-xs font-bold text-white">{stage.title}</span>
                  </div>
                </div>
                <span
                  className="font-display text-sm font-black font-mono-num"
                  style={{ color: stage.active ? stage.activeColor : '#dfe2f1' }}
                >
                  {stage.metric}
                </span>
              </div>

              <p className="text-[10px] text-[#dfe2f1]/65 mt-1.5">{stage.subtitle}</p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span
                  className="font-bold font-mono-num"
                  style={{ color: stage.active ? stage.activeColor : '#9ca3af' }}
                >
                  {stage.statusText}
                </span>
                <span className="text-[#dfe2f1]/45 font-mono-num">
                  {stage.active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Interactive Simulator Controls (when in Simulator mode) */}
        {sensorState.sensorSource === 'simulator' && (
          <div className="rounded-xl bg-[#141822] border border-[#262a35] p-3 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1.5 text-[11px]">
              <span className="font-bold text-[#00f1fd]">Interactive 4-Sensor Telemetry Tuner</span>
              <span className="font-mono-num text-[#dfe2f1]/70">
                Severity Score:{' '}
                <strong className={sensorState.crashDetected ? 'text-[#ff334b]' : 'text-[#4edea3]'}>
                  {sensorState.severityScore}%
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
              <label className="space-y-1 block">
                <div className="flex justify-between text-[#dfe2f1]/80">
                  <span>GPS Speed</span>
                  <span className="font-mono-num font-bold text-[#4edea3]">{Math.round(sensorState.speedKmh)} km/h</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={sensorState.speedKmh}
                  onChange={(e) => onChangeSpeed(Number(e.target.value))}
                  className="w-full accent-[#4edea3]"
                />
              </label>

              <label className="space-y-1 block">
                <div className="flex justify-between text-[#dfe2f1]/80">
                  <span>Impact G-Force</span>
                  <span className="font-mono-num font-bold text-[#ff334b]">{sensorState.gForce.toFixed(1)} G</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.1}
                  value={sensorState.gForce}
                  onChange={(e) => onChangeGForce(Number(e.target.value))}
                  className="w-full accent-[#ff334b]"
                />
              </label>

              <label className="space-y-1 block">
                <div className="flex justify-between text-[#dfe2f1]/80">
                  <span>Gyro Tilt Angle</span>
                  <span className="font-mono-num font-bold text-[#f59e0b]">{sensorState.gyroAngleDeg}°</span>
                </div>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={sensorState.gyroAngleDeg}
                  onChange={(e) => onChangeGyroAngle(Number(e.target.value))}
                  className="w-full accent-[#f59e0b]"
                />
              </label>

              <label className="space-y-1 block">
                <div className="flex justify-between text-[#dfe2f1]/80">
                  <span>Post-Impact Speed</span>
                  <span className="font-mono-num font-bold text-[#00f1fd]">{Math.round(sensorState.postImpactSpeedKmh)} km/h</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={sensorState.postImpactSpeedKmh}
                  onChange={(e) => onChangePostSpeed(Number(e.target.value))}
                  className="w-full accent-[#00f1fd]"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playEmergencyBeep();
                  onSimulateFullCrash();
                }}
                className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-gradient-to-r from-[#ff334b] to-[#be0035] text-white text-[11px] font-black uppercase tracking-wide shadow-md active:scale-95 transition-transform"
              >
                Test All 4 Crash Checks
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEffects.playHapticClick();
                  onEvaluateNow();
                }}
                className="py-2 px-3 rounded-xl bg-[#262a35] hover:bg-[#313540] text-[#00f1fd] text-[11px] font-bold transition-colors"
              >
                Verify via Local API
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEffects.playHapticClick();
                  onResetSensors();
                }}
                className="py-2 px-3 rounded-xl bg-[#1c1f2a] border border-[#313540] text-[#dfe2f1]/80 hover:text-white text-[11px] font-semibold transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
