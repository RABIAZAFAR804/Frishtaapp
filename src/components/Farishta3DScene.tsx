import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface Farishta3DSceneProps {
  speedKmh: number;
  gForce: number;
  gyroAngleDeg: number;
  crashDetected: boolean;
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical';
  onTriggerTestCrash?: () => void;
}

type CameraPreset = 'chase' | 'side' | 'radar';

const _vec3 = new THREE.Vector3();

export const Farishta3DScene: React.FC<Farishta3DSceneProps> = ({
  speedKmh,
  gForce,
  gyroAngleDeg,
  crashDetected,
  riskLevel = 'low',
  onTriggerTestCrash,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  // Mutable live telemetry refs so React state updates never recreate the WebGL scene
  const telemetryRef = useRef({ speedKmh, gForce, gyroAngleDeg, crashDetected, riskLevel });
  telemetryRef.current = { speedKmh, gForce, gyroAngleDeg, crashDetected, riskLevel };

  const presetRef = useRef<{ preset: CameraPreset; transitionActive: boolean }>({
    preset: 'chase',
    transitionActive: false,
  });

  const handlePresetChange = (next: CameraPreset) => {
    setCameraPreset(next);
    presetRef.current = { preset: next, transitionActive: true };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 280;

    // Software WebGL probe
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e18);
    scene.fog = new THREE.FogExp2(0x0a0e18, 0.055);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(3.4, 2.2, 4.1);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Mandatory studio environment map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 3-point warm/cool studio lighting
    const hemiLight = new THREE.HemisphereLight(0x8fe8ff, 0x171b26, 1.1);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.2);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f1fd, 1.4);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 8.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 0.55, 0);
    controls.addEventListener('start', () => {
      presetRef.current.transitionActive = false;
    });

    // Procedural asphalt grid + radar disc ground
    const gridTexCanvas = document.createElement('canvas');
    gridTexCanvas.width = 512;
    gridTexCanvas.height = 512;
    const gctx = gridTexCanvas.getContext('2d')!;
    gctx.fillStyle = '#0d121d';
    gctx.fillRect(0, 0, 512, 512);
    gctx.strokeStyle = 'rgba(0, 241, 253, 0.16)';
    gctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      gctx.beginPath();
      gctx.moveTo(i, 0);
      gctx.lineTo(i, 512);
      gctx.stroke();
      gctx.beginPath();
      gctx.moveTo(0, i);
      gctx.lineTo(512, i);
      gctx.stroke();
    }
    const floorTexture = new THREE.CanvasTexture(gridTexCanvas);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(6, 6);
    floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.CircleGeometry(14, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.78,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Contact shadow plane directly under bike
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d')!;
    const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.02;
    scene.add(contactShadow);

    // Concentric 3D Radar Rings on Ground
    const radarGroup = new THREE.Group();
    radarGroup.position.y = 0.03;
    const ringMatTeal = new THREE.MeshBasicMaterial({
      color: 0x00f1fd,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const ringMatEmerald = new THREE.MeshBasicMaterial({
      color: 0x4edea3,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.6, 64), ringMatTeal);
    ring1.rotation.x = -Math.PI / 2;
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.6, 64), ringMatEmerald);
    ring2.rotation.x = -Math.PI / 2;
    radarGroup.add(ring1, ring2);

    // Orbiting Farishta responder beacons
    const beaconGeo = new THREE.OctahedronGeometry(0.12, 0);
    const beaconMat1 = new THREE.MeshStandardMaterial({
      color: 0x4edea3,
      emissive: 0x4edea3,
      emissiveIntensity: 0.8,
      roughness: 0.25,
    });
    const beaconMat2 = new THREE.MeshStandardMaterial({
      color: 0x00f1fd,
      emissive: 0x00f1fd,
      emissiveIntensity: 0.8,
      roughness: 0.25,
    });
    const beacon1 = new THREE.Mesh(beaconGeo, beaconMat1);
    const beacon2 = new THREE.Mesh(beaconGeo, beaconMat2);
    radarGroup.add(beacon1, beacon2);
    scene.add(radarGroup);

    // Composite 11-Part Procedural 3D Motorcycle (THREE.Group) grounded at y=0
    const bikeGroup = new THREE.Group();
    const bikeBodyPivot = new THREE.Group(); // Pivots around tire contact line for lean/fall
    bikeGroup.add(bikeBodyPivot);
    scene.add(bikeGroup);

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.85, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xbec7d5, roughness: 0.25, metalness: 0.92 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x262a35, roughness: 0.45, metalness: 0.75 });
    const tankMat = new THREE.MeshPhysicalMaterial({
      color: 0xff334b,
      roughness: 0.2,
      metalness: 0.65,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9, metalness: 0.05 });
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f1fd,
      emissiveIntensity: 1.4,
      roughness: 0.15,
    });
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff334b,
      emissive: 0xff334b,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    const wheelRadius = 0.36;
    const makeWheel = (xPos: number) => {
      const wheel = new THREE.Group();
      wheel.position.set(xPos, wheelRadius, 0);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius - 0.06, 0.075, 16, 36), tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius - 0.12, wheelRadius - 0.12, 0.09, 20), rimMat);
      rim.rotation.x = Math.PI / 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(wheelRadius * 1.4, 0.03, 0.04), rimMat);
      const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, wheelRadius * 1.4, 0.04), rimMat);
      wheel.add(tire, rim, spoke, spoke2);
      return wheel;
    };

    const rearWheel = makeWheel(-0.82);
    const frontWheel = makeWheel(0.84);
    bikeBodyPivot.add(rearWheel, frontWheel);

    // 3. Main Chassis Frame
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 0.28), frameMat);
    chassis.position.set(-0.02, 0.56, 0);
    chassis.castShadow = true;
    bikeBodyPivot.add(chassis);

    // 4. Engine Block
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.34, 12), rimMat);
    engine.position.set(0.02, 0.42, 0);
    engine.rotation.z = Math.PI / 2;
    engine.castShadow = true;
    bikeBodyPivot.add(engine);

    // 5. Fuel Tank (sculpted capsule)
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 8, 16), tankMat);
    tank.position.set(0.24, 0.84, 0);
    tank.rotation.z = Math.PI / 2 - 0.12;
    tank.castShadow = true;
    bikeBodyPivot.add(tank);

    // 6. Rider Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.11, 0.26), seatMat);
    seat.position.set(-0.36, 0.76, 0);
    seat.rotation.z = 0.08;
    seat.castShadow = true;
    bikeBodyPivot.add(seat);

    // 7. Front Fork Tube
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.76, 12), rimMat);
    fork.position.set(0.68, 0.68, 0);
    fork.rotation.z = 0.42;
    fork.castShadow = true;
    bikeBodyPivot.add(fork);

    // 8. Handlebars
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.66, 10), frameMat);
    handlebar.position.set(0.54, 1.02, 0);
    handlebar.rotation.x = Math.PI / 2;
    bikeBodyPivot.add(handlebar);

    // 9. Headlight + Emissive Core
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), headlightMat);
    headlight.position.set(0.76, 0.9, 0);
    bikeBodyPivot.add(headlight);

    // 10. Taillight
    const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.16), taillightMat);
    taillight.position.set(-0.76, 0.74, 0);
    bikeBodyPivot.add(taillight);

    // 11. Smart IoT Guardian Beacon Pod (above tank)
    const guardianPodMat = new THREE.MeshStandardMaterial({
      color: 0x00f1fd,
      emissive: 0x00f1fd,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const guardianPod = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 1), guardianPodMat);
    guardianPod.position.set(0.24, 1.12, 0);
    bikeBodyPivot.add(guardianPod);

    // Shockwave Ring for Crash / High-Risk Alerts
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xff334b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.88, 48), shockMat);
    shockRing.rotation.x = -Math.PI / 2;
    shockRing.position.y = 0.04;
    scene.add(shockRing);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let currentLean = 0;
    let shockPhase = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const tel = telemetryRef.current;

      // Wheel rotation proportional to speed
      const wheelSpin = (tel.speedKmh / 3.6) * dt * 2.2;
      frontWheel.rotation.z -= wheelSpin;
      rearWheel.rotation.z -= wheelSpin;

      // Floor scroll illusion
      floorTexture.offset.x = (floorTexture.offset.x + tel.speedKmh * 0.0018 * dt * 60) % 1;

      // Bike lean / fall angle driven by gyroscope angle or crash state
      const targetAngleRad = THREE.MathUtils.degToRad(
        tel.crashDetected ? 74 : tel.gyroAngleDeg
      );
      currentLean = THREE.MathUtils.damp(currentLean, targetAngleRad, 5.5, dt);
      bikeBodyPivot.rotation.x = currentLean;

      // Subtle engine vibration
      const vib = tel.speedKmh > 0 && !tel.crashDetected ? Math.sin(elapsed * 28) * 0.004 : 0;
      bikeBodyPivot.position.y = vib;

      // Guardian pod color & spin based on crash / risk state
      const isAlert = tel.crashDetected || tel.gForce >= 4.0;
      const isWarn = tel.riskLevel === 'high' || tel.riskLevel === 'critical';
      guardianPod.rotation.y += dt * (isAlert ? 5.0 : 1.8);
      guardianPodMat.color.setHex(isAlert ? 0xff334b : isWarn ? 0xf59e0b : 0x00f1fd);
      guardianPodMat.emissive.setHex(isAlert ? 0xff334b : isWarn ? 0xf59e0b : 0x00f1fd);
      tankMat.color.setHex(isAlert ? 0xff1e38 : 0xff334b);

      // Orbiting Farishta responder beacons
      beacon1.position.set(Math.cos(elapsed * 0.9) * 1.58, 0.14 + Math.sin(elapsed * 2.5) * 0.04, Math.sin(elapsed * 0.9) * 1.58);
      beacon2.position.set(Math.cos(-elapsed * 0.65 + 2) * 2.58, 0.14 + Math.cos(elapsed * 2.1) * 0.04, Math.sin(-elapsed * 0.65 + 2) * 2.58);
      beacon1.rotation.y += dt * 2;
      beacon2.rotation.y -= dt * 2;

      // Crash shockwave ring pulse
      if (isAlert) {
        shockPhase = (shockPhase + dt * 1.5) % 1;
        const s = 1 + shockPhase * 2.6;
        shockRing.scale.set(s, s, 1);
        shockMat.opacity = (1 - shockPhase) * 0.75;
      } else {
        shockMat.opacity = THREE.MathUtils.damp(shockMat.opacity, 0, 6, dt);
      }

      // Smooth damped camera preset transitions
      if (presetRef.current.transitionActive) {
        if (presetRef.current.preset === 'chase') _vec3.set(3.4, 2.2, 4.1);
        else if (presetRef.current.preset === 'side') _vec3.set(0.1, 1.3, 4.2);
        else _vec3.set(0.01, 5.2, 1.8);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _vec3.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _vec3.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _vec3.z, 4.5, dt);
        if (camera.position.distanceTo(_vec3) < 0.05) {
          presetRef.current.transitionActive = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      envTex.dispose();
      floorTexture.dispose();
      shadowTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-64 sm:h-80 lg:h-[360px] rounded-3xl overflow-hidden border border-[#313540] bg-[#0a0e18] shadow-2xl">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Minimal Top-Left Spec Badge (No backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] flex items-center gap-2 rounded-xl bg-[#0a0e18]/90 border border-[#313540] px-2.5 sm:px-3 py-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{
            backgroundColor: crashDetected ? '#ff334b' : gForce >= 4 ? '#f59e0b' : '#4edea3',
          }}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white font-mono-num truncate">
            {crashDetected ? 'IMPACT FALL DETECTED' : '3D IMU TELEMETRY TWIN'}
          </span>
          <span className="text-[9px] sm:text-[10px] text-[#00f1fd] font-mono-num truncate">
            {Math.round(speedKmh)} km/h • {gForce.toFixed(2)}G • {Math.abs(gyroAngleDeg)}° tilt
          </span>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center w-[calc(100%-1.5rem)] max-w-md pointer-events-none">
        <button
          type="button"
          onClick={() => setControlsCollapsed(!controlsCollapsed)}
          className="pointer-events-auto mb-1 px-2.5 py-0.5 rounded-full bg-[#171b26] border border-[#313540] text-[10px] font-bold text-[#dfe2f1]/80 hover:text-white flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[13px]">
            {controlsCollapsed ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          </span>
          <span>{controlsCollapsed ? 'Show 3D Controls' : 'Hide Controls'}</span>
        </button>

        {!controlsCollapsed && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 rounded-2xl bg-[#171b26]/95 border border-[#313540] p-1 sm:p-1.5 shadow-xl">
            {(
              [
                { id: 'chase', label: '3D Chase' },
                { id: 'side', label: 'Tilt View' },
                { id: 'radar', label: 'Top Radar' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetChange(preset.id)}
                className={`px-2 sm:px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-colors whitespace-nowrap ${
                  cameraPreset === preset.id
                    ? 'bg-[#00f1fd] text-[#00373a]'
                    : 'text-[#dfe2f1]/80 hover:bg-[#262a35]'
                }`}
              >
                {preset.label}
              </button>
            ))}

            {onTriggerTestCrash && (
              <button
                type="button"
                onClick={onTriggerTestCrash}
                className="px-2 sm:px-2.5 py-1 rounded-xl bg-[#ff334b] text-white text-[10px] sm:text-[11px] font-black hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Simulate Fall
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
