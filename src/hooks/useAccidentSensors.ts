import { useState, useEffect, useCallback, useRef } from 'react';
import { SmartSensorState, SmartSensorStageResult } from '../types';

function evaluateLocally(
  speedKmh: number,
  gForce: number,
  gyroAngleDeg: number,
  postImpactSpeedKmh: number
): { crashDetected: boolean; severityScore: number; stages: SmartSensorStageResult } {
  const speedCheckPassed = speedKmh >= 12;
  const suddenImpactTriggered = gForce >= 4.0;
  const directionChangeTriggered = Math.abs(gyroAngleDeg) >= 55;
  const movementCheckTriggered =
    suddenImpactTriggered && (postImpactSpeedKmh <= 3 || Math.abs(speedKmh - postImpactSpeedKmh) >= 18);

  const severityScore = Math.min(
    100,
    Math.round(
      (speedCheckPassed ? 20 : 0) +
        Math.min(40, Math.max(0, (gForce - 1) * 7)) +
        Math.min(25, Math.abs(gyroAngleDeg) * 0.35) +
        (movementCheckTriggered ? 20 : 0)
    )
  );

  const crashDetected =
    (suddenImpactTriggered && (directionChangeTriggered || movementCheckTriggered)) || gForce >= 6.5;

  return {
    crashDetected,
    severityScore,
    stages: {
      speedCheck: {
        passed: speedCheckPassed,
        speedKmh,
        label: speedCheckPassed ? 'VEHICLE TRANSIT CONFIRMED' : 'STATIONARY / WALKING',
        detail: `GPS Speed ${Math.round(speedKmh)} km/h (Active vehicle ≥ 12 km/h)`,
      },
      suddenImpact: {
        triggered: suddenImpactTriggered,
        gForce,
        label: suddenImpactTriggered ? 'STRONG IMPACT SPIKE' : 'NORMAL G-LOAD',
        detail: `Accelerometer ${gForce.toFixed(2)}G (Threshold ≥ 4.0G)`,
      },
      directionChange: {
        triggered: directionChangeTriggered,
        angleDeg: gyroAngleDeg,
        label: directionChangeTriggered ? 'BIKE FALL / TILT DETECTED' : 'UPRIGHT STABILITY',
        detail: `Gyroscope ${Math.abs(gyroAngleDeg).toFixed(0)}° tilt (Threshold ≥ 55°)`,
      },
      movementCheck: {
        triggered: movementCheckTriggered,
        postImpactSpeedKmh,
        label: movementCheckTriggered ? 'SUDDEN STOP / IMMOBILE' : 'CONTINUOUS MOTION',
        detail: `Post-impact GPS ${Math.round(postImpactSpeedKmh)} km/h`,
      },
    },
  };
}

export function useAccidentSensors(
  autoDetectEnabled: boolean,
  lat: number,
  lng: number,
  onCrashDetected: () => void
) {
  const hardwareSupported =
    typeof window !== 'undefined' &&
    ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window);

  const [sensorSource, setSensorSource] = useState<'hardware' | 'simulator'>('simulator');
  const [speedKmh, setSpeedKmh] = useState(48);
  const [gForce, setGForce] = useState(1.02);
  const [gyroAngleDeg, setGyroAngleDeg] = useState(3);
  const [postImpactSpeedKmh, setPostImpactSpeedKmh] = useState(48);

  const initialEval = evaluateLocally(48, 1.02, 3, 48);
  const [sensorState, setSensorState] = useState<SmartSensorState>({
    speedKmh: 48,
    gForce: 1.02,
    gyroAngleDeg: 3,
    postImpactSpeedKmh: 48,
    sensorSource: 'simulator',
    hardwareSupported,
    crashDetected: initialEval.crashDetected,
    severityScore: initialEval.severityScore,
    stages: initialEval.stages,
    lastEvaluatedAt: new Date().toISOString(),
  });

  const crashFiredRef = useRef(false);

  const syncTelemetry = useCallback(
    async (
      nextSpeed: number,
      nextG: number,
      nextAngle: number,
      nextPostSpeed: number,
      source: 'hardware' | 'simulator'
    ) => {
      const localEval = evaluateLocally(nextSpeed, nextG, nextAngle, nextPostSpeed);
      setSensorState({
        speedKmh: nextSpeed,
        gForce: nextG,
        gyroAngleDeg: nextAngle,
        postImpactSpeedKmh: nextPostSpeed,
        sensorSource: source,
        hardwareSupported,
        crashDetected: localEval.crashDetected,
        severityScore: localEval.severityScore,
        stages: localEval.stages,
        lastEvaluatedAt: new Date().toISOString(),
      });

      try {
        const res = await fetch('/api/sensors/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            speedKmh: nextSpeed,
            gForce: nextG,
            gyroAngleDeg: nextAngle,
            postImpactSpeedKmh: nextPostSpeed,
            lat,
            lng,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSensorState((prev) => ({
            ...prev,
            crashDetected: Boolean(data.crashDetected),
            severityScore: Number(data.severityScore ?? prev.severityScore),
            stages: data.stages || prev.stages,
            lastEvaluatedAt: data.evaluatedAt || new Date().toISOString(),
          }));

          if (data.crashDetected && autoDetectEnabled && !crashFiredRef.current) {
            crashFiredRef.current = true;
            onCrashDetected();
            setTimeout(() => {
              crashFiredRef.current = false;
            }, 5000);
          }
          return Boolean(data.crashDetected);
        }
      } catch {
        // Offline local evaluation
        if (localEval.crashDetected && autoDetectEnabled && !crashFiredRef.current) {
          crashFiredRef.current = true;
          onCrashDetected();
          setTimeout(() => {
            crashFiredRef.current = false;
          }, 5000);
        }
      }
      return localEval.crashDetected;
    },
    [autoDetectEnabled, hardwareSupported, lat, lng, onCrashDetected]
  );

  // Subtle simulator ambient stream when in simulator mode
  useEffect(() => {
    if (sensorSource !== 'simulator') return;
    const interval = setInterval(() => {
      setGForce((prev) => (prev > 3 ? prev : +(1.0 + (Math.random() * 0.08 - 0.04)).toFixed(2)));
      setGyroAngleDeg((prev) => (Math.abs(prev) > 25 ? prev : Math.round(Math.random() * 8 - 4)));
    }, 1500);
    return () => clearInterval(interval);
  }, [sensorSource]);

  // Keep sensorState synced when simulator values update
  useEffect(() => {
    const evalRes = evaluateLocally(speedKmh, gForce, gyroAngleDeg, postImpactSpeedKmh);
    setSensorState((prev) => ({
      ...prev,
      speedKmh,
      gForce,
      gyroAngleDeg,
      postImpactSpeedKmh,
      sensorSource,
      crashDetected: evalRes.crashDetected,
      severityScore: evalRes.severityScore,
      stages: evalRes.stages,
      lastEvaluatedAt: new Date().toISOString(),
    }));
  }, [speedKmh, gForce, gyroAngleDeg, postImpactSpeedKmh, sensorSource]);

  // Hardware IMU + GPS listeners when user activates Live Device Sensors
  useEffect(() => {
    if (sensorSource !== 'hardware') return;

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const mps = pos.coords.speed ?? 0;
          const kmh = Math.max(0, Math.round(mps * 3.6));
          setSpeedKmh(kmh);
          setPostImpactSpeedKmh(kmh);
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;
      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;
      const totalG = +(Math.hypot(x, y, z) / 9.81).toFixed(2);
      setGForce(totalG);
      if (totalG >= 4.0) {
        syncTelemetry(speedKmh, totalG, gyroAngleDeg, 0, 'hardware');
      }
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = Math.round(e.gamma ?? 0);
      const beta = Math.round(e.beta ?? 0);
      const tilt = Math.abs(gamma) > Math.abs(beta) ? gamma : beta;
      setGyroAngleDeg(Math.min(90, Math.max(-90, tilt)));
    };

    window.addEventListener('devicemotion', handleMotion);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('devicemotion', handleMotion);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [sensorSource, speedKmh, gyroAngleDeg, syncTelemetry]);

  const enableHardwareSensors = async () => {
    try {
      const dm = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof dm?.requestPermission === 'function') {
        await dm.requestPermission();
      }
    } catch {
      // Non-iOS browsers don't require explicit permission
    }
    setSensorSource('hardware');
  };

  const triggerFullFourStageCrashSimulation = async () => {
    setSensorSource('simulator');
    setSpeedKmh(58);
    setGForce(8.45);
    setGyroAngleDeg(78);
    setPostImpactSpeedKmh(0);
    await syncTelemetry(58, 8.45, 78, 0, 'simulator');
  };

  const resetSensorsToNormal = async () => {
    crashFiredRef.current = false;
    setSpeedKmh(48);
    setGForce(1.02);
    setGyroAngleDeg(3);
    setPostImpactSpeedKmh(48);
    await syncTelemetry(48, 1.02, 3, 48, 'simulator');
  };

  return {
    sensorState,
    setSpeedKmh,
    setGForce,
    setGyroAngleDeg,
    setPostImpactSpeedKmh,
    setSensorSource,
    enableHardwareSensors,
    evaluateNow: () => syncTelemetry(speedKmh, gForce, gyroAngleDeg, postImpactSpeedKmh, sensorSource),
    triggerFullFourStageCrashSimulation,
    resetSensorsToNormal,
  };
}
