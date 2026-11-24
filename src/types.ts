export type TabType = 'monitor' | 'contacts' | 'emergency' | 'radar' | 'services' | 'medical' | 'safety-hub';

export * from './types/blog';

export type UserRoleMode = 'victim' | 'witness';

export type ServiceCategory = 'all' | 'rescue' | 'hospital' | 'mobility' | 'community';

export interface EmergencyService {
  id: string;
  name: string;
  category: 'rescue' | 'hospital' | 'mobility' | 'community';
  shortCode?: string; // e.g. "1122", "115", "1020"
  phone: string;
  address: string;
  distance: string;
  distanceKm: number;
  eta: string;
  badge: string;
  description: string;
  status: string;
  verified: boolean;
  capabilities: string[];
  icon: string;
  color: string;
  coords: { x: number; y: number }; // Radar map coordinates
}

export interface HospitalDestination {
  id: string;
  name: string;
  type: string;
  address: string;
  distance: string;
  distanceKm: number;
  eta: string;
  icuBeds: number;
  bloodBank: boolean;
  traumaLevel: string;
  phone: string;
  assigned1122Station: string;
  assigned1122Distance: string;
  assigned1122Eta: string;
  ambulanceBay: string;
}

export interface Rescue1122Headquarter {
  id: string;
  name: string;
  division: string;
  location: string;
  officerInCharge: string;
  hotline: string;
  pingLatency: string;
  status: 'ONLINE' | 'ACTIVE_DESK' | 'CAD_SYNCED';
  coverageZones: string[];
}

export interface RescueSystemConfig {
  primarySystem: EmergencyService; // Permanent 1122 (LOCKED #1)
  secondarySystem: EmergencyService; // Selected by victim (Edhi, Chhipa, Bykea, etc.)
  targetHospital: HospitalDestination; // Nearest hospital chosen by victim
  forwardToAll1122Headquarters: boolean; // Broadcast to ALL 1122 HQs
  autoHospitalPreAlert: boolean; // Pre-notify hospital trauma bay
}

export interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary?: boolean;
  enabledAlert?: boolean; // Controls whether this contact receives the automatic accident SMS alert
  avatarUrl?: string;
  notes?: string;
  proximity?: string;
}

export interface Responder {
  id: string;
  name: string;
  role: string;
  affiliation: string;
  distance: string;
  distanceMeters: number;
  eta: string;
  badge: string;
  avatarUrl: string;
  equipment: string;
  status: 'accepting' | 'en_route' | 'on_scene';
  phone: string;
  coords: { x: number; y: number }; // Radar coordinates in percentage (0-100)
}

export interface TelemetryData {
  gForce: number;
  speedKmh: number;
  locationName: string;
  coordinates: string;
  gpsAccuracy: string;
  satellites: number;
  batteryVoltage: string;
  audioDecibels: number;
  rolloverPitch: number;
  cadSyncLatency: string;
}

export interface CadPipelineStep {
  id: string;
  title: string;
  subtitle: string;
  status: 'active' | 'pending' | 'completed' | 'queued';
  tag: string;
}

export interface DetectedLocation {
  lat: number;
  lng: number;
  areaName: string;
  city: string;
  accuracyMeters: number;
  source: 'gps' | 'preset';
  updatedAt: string;
}

export interface NearbyDoctor {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  clinicName: string;
  address: string;
  distance: string;
  distanceKm: number;
  eta: string;
  phone: string;
  available24x7: boolean;
  onCallNow: boolean;
  verified: boolean;
  lat: number;
  lng: number;
  color: string;
}

export interface NearbyHospital extends HospitalDestination {
  lat: number;
  lng: number;
  emergencyOpen: boolean;
}

export interface PredictiveWarning {
  id: string;
  title: string;
  message: string;
  leadTimeMinutes: number; // 20 - 30 min early warning
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendedMaxSpeedKmh: number;
  hazardType: 'blackspot' | 'weather' | 'fatigue' | 'speed_corridor' | 'intersection';
  zoneName: string;
  timestamp: string;
}

export interface SmartSensorStageResult {
  speedCheck: {
    passed: boolean;
    speedKmh: number;
    label: string;
    detail: string;
  };
  suddenImpact: {
    triggered: boolean;
    gForce: number;
    label: string;
    detail: string;
  };
  directionChange: {
    triggered: boolean;
    angleDeg: number;
    label: string;
    detail: string;
  };
  movementCheck: {
    triggered: boolean;
    postImpactSpeedKmh: number;
    label: string;
    detail: string;
  };
}

export interface SmartSensorState {
  speedKmh: number;
  gForce: number;
  gyroAngleDeg: number;
  postImpactSpeedKmh: number;
  sensorSource: 'hardware' | 'simulator';
  hardwareSupported: boolean;
  crashDetected: boolean;
  severityScore: number;
  stages: SmartSensorStageResult;
  lastEvaluatedAt: string;
}

export type TeamAvailabilityStatus = 'AVAILABLE' | 'BUSY';

export type TeamDispatchStatus =
  | 'STANDBY'
  | 'ASSIGNED'
  | 'STOOD_DOWN'
  | 'BUSY_SKIPPED'
  | 'ARRIVED';

export type DispatchStage =
  | 'STANDBY'
  | 'ACCIDENT_DETECTED'
  | 'CONTROL_ROOM_NOTIFIED'
  | 'TEAM_DISPATCHED'
  | 'OTHER_TEAMS_NOTIFIED'
  | 'FAMILY_NOTIFIED'
  | 'ARRIVED_ON_SCENE';

export interface RescueTeamUnit {
  id: string;
  name: string;
  agency: string;
  controlRoom: string;
  unitType: string;
  capabilities: string[];
  phone: string;
  lat: number;
  lng: number;
  distanceKm: number;
  distance: string;
  etaMinutes: number;
  eta: string;
  availability: TeamAvailabilityStatus;
  suitabilityScore: number;
  dispatchStatus: TeamDispatchStatus;
  notificationMessage?: string;
}

export interface FamilyDispatchNotification {
  contactId: string;
  name: string;
  relation: string;
  phone: string;
  message: string;
  sentAt: string;
  arrivalNotified?: boolean;
}

export interface SmartDispatchStep {
  key:
    | 'accident_detected'
    | 'services_notified'
    | 'team_dispatched'
    | 'other_teams_notified'
    | 'family_notified'
    | 'arrival_confirmed';
  stepNumber: number;
  title: string;
  subtitle: string;
  completed: boolean;
  timestamp?: string;
}

export interface SmartDispatchCase {
  incidentId: string;
  stage: DispatchStage;
  createdAt: string;
  arrivedAt?: string;
  arrivalConfirmed: boolean;
  location: {
    lat: number;
    lng: number;
    areaName: string;
    city: string;
  };
  severityScore: number;
  gForce: number;
  controlRoomName: string;
  targetHospitalName: string;
  assignedTeam: RescueTeamUnit;
  otherTeams: RescueTeamUnit[];
  standDownMessage: string;
  familyNotifications: FamilyDispatchNotification[];
  steps: SmartDispatchStep[];
}


