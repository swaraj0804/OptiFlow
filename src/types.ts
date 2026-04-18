export type LaneDirection = 'North' | 'South' | 'East' | 'West';
export type TurnDirection = 'Straight' | 'Left' | 'Right';
export type VehicleType = 'Car' | 'Ambulance' | 'FireBrigade' | 'PoliceCar';

export interface Vehicle {
  id: string;
  type: VehicleType;
  source: LaneDirection;
  turn: TurnDirection;
  progress: number; // 0 to 1 (0 is start of road, 1 is end)
  speed: number;
  stopped: boolean;
  laneIndex: number; // 0 or 1 for multi-lane roads if we want
}

export interface LaneState {
  direction: LaneDirection;
  density: number;
  signalState: 'Red' | 'Yellow' | 'Green';
  hasEmergency: boolean;
  emergencyType?: 'Ambulance' | 'Fire' | 'Police';
  emergencyTimestamp?: number;
}

export interface SimulationState {
  lanes: Record<LaneDirection, LaneState>;
  emergencyQueue: { lane: LaneDirection; timestamp: number; type: 'Ambulance' | 'Fire' | 'Police'; spentTime: number; vehicleId: string }[];
  vehicles: Vehicle[];
  timestamp: number;
  totalEmergencyPassed: number;
  isDisasterMode: boolean;
  disasterSource?: LaneDirection;
}

export interface MetricsPoint {
  time: string;
  north: number;
  south: number;
  east: number;
  west: number;
  avgWait: number;
  totalLoad: number;
}

export interface AuditLog {
  id: number;
  event: string;
  density: number;
  timestamp: string;
}
