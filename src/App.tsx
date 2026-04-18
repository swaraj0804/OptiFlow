import React, { useState, useEffect } from "react";
import {
  Activity,
  Zap,
  BrainCircuit,
  RefreshCw,
  Bell,
  Terminal,
  History,
  ShieldCheck,
  LogOut,
  User
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";
import {
  LaneDirection,
  LaneState,
  SimulationState,
  MetricsPoint,
  AuditLog,
  TurnDirection,
  VehicleType
} from "./types";
import { Intersection } from "./components/Intersection";
import { Auth } from "./components/Auth";
import { cn } from "./lib/utils";
import { analyzeTraffic } from "./services/geminiService";
import { supabase } from "./lib/supabase";
import { Session } from "@supabase/supabase-js";

const INITIAL_STATE: SimulationState = {
  lanes: {
    North: { direction: 'North', density: 0.2, signalState: 'Green', hasEmergency: false },
    South: { direction: 'South', density: 0.4, signalState: 'Red', hasEmergency: false },
    East: { direction: 'East', density: 0.1, signalState: 'Red', hasEmergency: false },
    West: { direction: 'West', density: 0.3, signalState: 'Red', hasEmergency: false },
  },
  emergencyQueue: [],
  vehicles: [],
  timestamp: Date.now(),
  totalEmergencyPassed: 0,
  isDisasterMode: false
};

const PRIORITY_LEVELS: Record<string, number> = {
  'Ambulance': 0,
  'Fire': 1,
  'Police': 2
};

const VEHICLE_TO_EMERGENCY: Record<VehicleType, 'Ambulance' | 'Fire' | 'Police' | null> = {
  'Ambulance': 'Ambulance',
  'FireBrigade': 'Fire',
  'PoliceCar': 'Police',
  'Car': null
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sim, setSim] = useState<SimulationState>(INITIAL_STATE);
  const [isRunning, setIsRunning] = useState(true);
  const [metrics, setMetrics] = useState<MetricsPoint[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Precision Autonomous Signal & Vehicle Controller
  useEffect(() => {
    if (!isRunning) return;

    const controller = () => {
      setSim(prev => {
        const newLanes = { ...prev.lanes };
        const directions: LaneDirection[] = ['North', 'East', 'South', 'West'];
        const newQueue = [...prev.emergencyQueue];
        let emergencyPassed = prev.totalEmergencyPassed;

        // --- 1. Global Priority Logic (Disaster vs Standard) ---
        if (prev.isDisasterMode && prev.disasterSource) {
          // DISASTER OVERRIDE: Keep disaster road open exclusively
          directions.forEach(d => {
            newLanes[d].signalState = (d === prev.disasterSource) ? 'Green' : 'Red';
          });
        }
        else if (newQueue.length > 0) {
          // Priority Triage (Multiple Emergency Vehicles)
          const delta = Date.now() - prev.timestamp;
          newQueue[0] = { ...newQueue[0], spentTime: newQueue[0].spentTime + delta };

          const activeEmergency = newQueue[0];
          const timeInPriority = activeEmergency.spentTime;

          // Clearance Check: Has the specifically tracked vehicle passed?
          const targetVehicle = prev.vehicles.find(v => v.id === activeEmergency.vehicleId);
          const hasPassed = !targetVehicle || targetVehicle.progress > 0.75;
          const safetyTimeout = timeInPriority > 20000;

          if (hasPassed || safetyTimeout) {
            const lane = newLanes[activeEmergency.lane];
            const nextInLane = newQueue.slice(1).some(q => q.lane === activeEmergency.lane);
            if (!nextInLane) lane.hasEmergency = false;

            newQueue.shift();
            emergencyPassed += 1;
          } else {
            directions.forEach(d => {
              if (d === activeEmergency.lane) {
                newLanes[d].signalState = timeInPriority > 18000 ? 'Yellow' : 'Green';
              } else {
                newLanes[d].signalState = 'Red';
              }
            });
          }
        } else {
          // Standard Round-Robin
          const now = Date.now();
          const cycleLength = 5000;
          const totalCycle = cycleLength * directions.length;
          const elapsedInTotalCycle = now % totalCycle;

          const activeLaneIndex = Math.floor(elapsedInTotalCycle / cycleLength);
          const timeInLaneSlot = elapsedInTotalCycle % cycleLength;
          const activeLaneId = directions[activeLaneIndex];

          directions.forEach((d) => {
            if (d === activeLaneId) {
              newLanes[d].signalState = timeInLaneSlot < 4000 ? 'Green' : 'Yellow';
            } else {
              newLanes[d].signalState = 'Red';
            }
          });
        }

        // --- 3. Junction Occupancy Awareness ---
        const JUNCTION_START = 0.33;

        const isJunctionBlockedByOthers = (source: LaneDirection) => {
          return prev.vehicles.some(other =>
            other.source !== source &&
            other.progress >= JUNCTION_START &&
            other.progress < 0.75
          );
        };

        // --- 4. Vehicle Movement Logic ---
        const STOP_PROGRESS = 0.32;
        const SAFE_DISTANCE = 0.12;

        const newVehicles = prev.vehicles.map(v => {
          let stopped = false;
          const road = newLanes[v.source];
          const isEmergencyV = v.type !== 'Car';
          const signalIsGreen = road.signalState === 'Green';

          // BYPASS LOGIC: Emergency vehicles ignore red if junction is clear of others
          const junctionClear = !isJunctionBlockedByOthers(v.source);
          const canBypass = isEmergencyV && junctionClear;
          const canProceed = (signalIsGreen || canBypass) && junctionClear;

          if (v.progress < STOP_PROGRESS && v.progress + v.speed > STOP_PROGRESS) {
            if (!canProceed) stopped = true;
          }

          // Single Lane Collision Check
          const carAhead = prev.vehicles.find(other =>
            other.id !== v.id &&
            other.source === v.source &&
            other.progress > v.progress &&
            other.progress < v.progress + SAFE_DISTANCE
          );

          if (carAhead) {
            const gap = carAhead.progress - v.progress;
            if (canProceed) {
              if (gap < SAFE_DISTANCE * 0.35) stopped = true;
            } else {
              if (carAhead.stopped || gap < SAFE_DISTANCE * 0.75) stopped = true;
            }
          }

          if (v.progress >= STOP_PROGRESS && v.progress < 0.75) stopped = false;

          if (stopped) return { ...v, stopped: true };
          return { ...v, progress: v.progress + v.speed, stopped: false };
        }).filter(v => v.progress < 1.2);

        return {
          ...prev,
          lanes: newLanes,
          vehicles: newVehicles,
          emergencyQueue: newQueue,
          totalEmergencyPassed: emergencyPassed,
          timestamp: Date.now()
        };
      });
    };

    const interval = setInterval(controller, 50);
    return () => clearInterval(interval);
  }, [isRunning, sim.isDisasterMode, sim.disasterSource]);

  // Single Lane Spawner - Randomized
  useEffect(() => {
    if (!isRunning) return;

    let timeoutId: NodeJS.Timeout;

    const spawner = () => {
      const directions: LaneDirection[] = ['North', 'South', 'East', 'West'];
      const source = directions[Math.floor(Math.random() * directions.length)];
      const count = Math.floor(Math.random() * (sim.isDisasterMode ? 5 : 3)) + 1;
      const turnOptions: TurnDirection[] = ['Straight', 'Left', 'Right'];

      const isRareEmergency = Math.random() < 0.05; // 5% chance of random emergency in normal mode
      const typeOptions: VehicleType[] = (sim.isDisasterMode || isRareEmergency) ?
        ['Ambulance', 'PoliceCar', 'FireBrigade'] :
        ['Car'];

      const newBatch = Array.from({ length: count }).map((_, i) => {
        const id = Math.random().toString(36).substr(2, 9);
        // Randomize speed slightly (0.004 to 0.007)
        const speed = 0.004 + (Math.random() * 0.003);
        // Randomize starting position spread
        const progress = -0.15 * i - (Math.random() * 0.05);

        return {
          id,
          type: typeOptions[Math.floor(Math.random() * typeOptions.length)] as VehicleType,
          source,
          turn: turnOptions[Math.floor(Math.random() * turnOptions.length)],
          progress,
          speed,
          stopped: false,
          laneIndex: 0
        };
      });

      setSim(prev => {
        const laneFull = prev.vehicles.some(v => v.source === source && v.progress < 0);
        if (laneFull) return prev;

        const updatedLanes = { ...prev.lanes };
        const newQueueEntries = newBatch.map(v => {
          const eType = VEHICLE_TO_EMERGENCY[v.type];
          if (eType) {
            updatedLanes[v.source].hasEmergency = true;
            updatedLanes[v.source].emergencyType = eType;
            return {
              lane: v.source,
              timestamp: Date.now(),
              type: eType,
              spentTime: 0,
              vehicleId: v.id
            };
          }
          return null;
        }).filter(Boolean) as SimulationState['emergencyQueue'];

        const fullQueue = [...prev.emergencyQueue, ...newQueueEntries].sort((a, b) => {
          if (PRIORITY_LEVELS[a.type] !== PRIORITY_LEVELS[b.type]) {
            return PRIORITY_LEVELS[a.type] - PRIORITY_LEVELS[b.type];
          }
          return a.timestamp - b.timestamp;
        });

        return {
          ...prev,
          lanes: updatedLanes,
          vehicles: [...prev.vehicles, ...newBatch],
          emergencyQueue: fullQueue
        };
      });

      // Variable next spawn delay (Normal: 2s-6s, Disaster: 0.5s-2s)
      const minDelay = sim.isDisasterMode ? 500 : 2000;
      const maxDelay = sim.isDisasterMode ? 2000 : 6000;
      const nextDelay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

      timeoutId = setTimeout(spawner, nextDelay);
    };

    timeoutId = setTimeout(spawner, 1000);
    return () => clearTimeout(timeoutId);
  }, [isRunning, sim.isDisasterMode]);

  const simRef = React.useRef(sim);
  useEffect(() => { simRef.current = sim; }, [sim]);

  // Telemetry Engine - Smoother and real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        const currentSim = simRef.current;
        const getDensity = (dir: LaneDirection) => {
          const count = currentSim.vehicles.filter(v => v.source === dir && v.progress < 0.33).length;
          return Math.min(count / 10, 1.0);
        };

        const n = getDensity('North'), s = getDensity('South'), e = getDensity('East'), w = getDensity('West');
        const load = (n + s + e + w) / 4;
        const stoppedCount = currentSim.vehicles.filter(v => v.stopped).length;

        const point: MetricsPoint = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          north: n,
          south: s,
          east: e,
          west: w,
          totalLoad: load * 100,
          avgWait: Math.round(stoppedCount * 1.5)
        };
        return [...prev, point].slice(-30);
      });
    }, 200); // 200ms for real-time smoothness
    return () => clearInterval(interval);
  }, []);

  const logEvent = async (event: string, density: number) => {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, density, timestamp: new Date().toISOString() })
      });
      fetchLogs(); // Optimistic update
    } catch (e) { console.error('Logging failed', e); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) { console.error('Fetch logs failed', e); }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerEmergency = (dir: LaneDirection, type: 'Ambulance' | 'Fire' | 'Police') => {
    logEvent(`Emergency: ${type} at ${dir}`, 0);
    setSim(prev => {
      const newLanes = { ...prev.lanes };
      const vType: VehicleType = type === 'Ambulance' ? 'Ambulance' : type === 'Fire' ? 'FireBrigade' : 'PoliceCar';
      const vId = Math.random().toString(36).substr(2, 9);

      newLanes[dir].hasEmergency = true;
      newLanes[dir].emergencyType = type;
      newLanes[dir].emergencyTimestamp = Date.now();

      const newEntry = { lane: dir, timestamp: Date.now(), type, spentTime: 0, vehicleId: vId };
      const newQueue = [...prev.emergencyQueue, newEntry].sort((a, b) => {
        if (PRIORITY_LEVELS[a.type] !== PRIORITY_LEVELS[b.type]) {
          return PRIORITY_LEVELS[a.type] - PRIORITY_LEVELS[b.type];
        }
        return a.timestamp - b.timestamp;
      });

      const emergencyVehicle = {
        id: vId,
        type: vType,
        source: dir,
        turn: 'Straight' as TurnDirection,
        progress: -0.1,
        speed: 0.005,
        stopped: false,
        laneIndex: 0
      };

      return {
        ...prev,
        lanes: newLanes,
        emergencyQueue: newQueue,
        vehicles: [emergencyVehicle, ...prev.vehicles]
      };
    });
  };

  const handleAIAnalyze = async () => {
    setIsAnalyzing(true);
    const lastMetrics = metrics[metrics.length - 1];
    const events = logs.slice(0, 3).map(l => l.event).join(', ');

    const dataContext = lastMetrics ?
      `STATUS: ${sim.isDisasterMode ? 'DISASTER_OVERRIDE' : 'OPTIMIZED_FLOW'}. 
       LOAD: ${Math.round(lastMetrics.totalLoad)}%. 
       WAIT: ${lastMetrics.avgWait}s. 
       RECENT_EVENTS: ${events || 'None'}.
       LANES: N:${Math.round(lastMetrics.north * 100)}%, S:${Math.round(lastMetrics.south * 100)}%, E:${Math.round(lastMetrics.east * 100)}%, W:${Math.round(lastMetrics.west * 100)}%` :
      "Initializing predictive scan...";

    const result = await analyzeTraffic(dataContext);
    setAiInsight(result);
    setIsAnalyzing(false);
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-bg text-neutral-100 font-sans selection:bg-accent-blue/30 flex flex-col relative overflow-hidden">
      {/* Immersive Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-blue/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent-red/5 blur-[120px]" />
      </div>

      <header className="h-[60px] border-b border-border flex justify-between items-center px-6 bg-surface/80 backdrop-blur-md z-50">
        {sim.isDisasterMode && (
          <div className="absolute inset-0 bg-accent-red/5 pointer-events-none animate-pulse-slow z-[-1]" />
        )}
        <div className="flex items-center gap-3">
          <div className="logo font-mono font-bold text-[14px] tracking-[2px] text-accent-blue uppercase">
            SIGNAL.CORE // AUTO_SYNC
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 group px-3 py-1 bg-white/5 border border-white/5">
            <User className="w-3 h-3 text-text-secondary" />
            <span className="text-[9px] font-mono text-text-secondary uppercase truncate max-w-[120px]">
              {session?.user.email?.split('@')[0]}
            </span>
          </div>
          <div className="flex items-center gap-2 group px-3 py-1 bg-white/5 border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <span className="text-[10px] font-mono text-text-secondary uppercase">Network_Sync: Nominal</span>
          </div>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={cn(
              "px-4 py-1 border text-[10px] font-bold uppercase transition-all",
              isRunning ? "border-accent-green text-accent-green bg-accent-green/10" : "border-accent-red text-accent-red bg-accent-red/10"
            )}
          >
            {isRunning ? "MASTER_ACTIVE" : "MASTER_PAUSED"}
          </button>
          <button onClick={() => setSim(INITIAL_STATE)} className="p-1 hover:text-accent-blue transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 border border-border bg-white/5 hover:bg-accent-red hover:border-accent-red hover:text-white transition-all ml-2"
            title="Disconnect Sequence"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
        <section className="p-6 flex flex-col gap-6 overflow-auto bg-bg">
          <div className="flex justify-between items-center px-4 py-2 border-l border-accent-blue bg-accent-blue/5">
            <span className="text-[10px] font-mono text-accent-blue uppercase font-bold tracking-[2px]">Autonomous Sequencer v4.2</span>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 opacity-50"><div className="w-1.5 h-1.5 rounded-full bg-accent-green" /><span className="text-[9px] uppercase font-mono">Passing</span></div>
              <div className="flex items-center gap-2 opacity-50"><div className="w-1.5 h-1.5 rounded-full bg-accent-red" /><span className="text-[9px] uppercase font-mono">Blocked</span></div>
            </div>
          </div>

          <div className="flex-1 border border-border flex flex-col bg-black/20 relative overflow-hidden">
            <div className="flex-1 flex items-center justify-center relative overflow-hidden border-b border-border/50">
              <Intersection lanes={sim.lanes} vehicles={sim.vehicles} />
              <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 font-mono text-[10px]">
                  <Activity className="w-3 h-3 text-accent-blue" />
                  <span className="uppercase tracking-widest text-white/80">Visualizer.Active</span>
                </div>
              </div>

              {/* Scenario & Controls HUD */}
              <div className="absolute top-4 right-4 flex flex-col items-end gap-3 scale-[0.85] origin-top-right">
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[9px] font-mono text-text-secondary uppercase tracking-[2px]">Traffic_Scenarios</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSim({ ...INITIAL_STATE })} className="px-2 py-1 bg-white/5 border border-white/10 text-[8px] font-mono uppercase hover:border-accent-blue transition-all">Normal</button>
                    <button
                      onClick={() => {
                        const dirs: LaneDirection[] = ['North', 'South', 'East', 'West'];
                        const types: ('Ambulance' | 'Fire' | 'Police')[] = ['Ambulance', 'Fire', 'Police'];
                        const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
                        const randomType = types[Math.floor(Math.random() * types.length)];
                        triggerEmergency(randomDir, randomType);
                      }}
                      className="px-2 py-1 bg-white/5 border border-white/10 text-[8px] font-mono uppercase hover:border-accent-red transition-all"
                    >
                      Single_Priority
                    </button>
                    <button
                      onClick={() => {
                        const dirs = (['North', 'East', 'South', 'West'] as LaneDirection[]).sort(() => Math.random() - 0.5);
                        triggerEmergency(dirs[0], 'Ambulance');
                        setTimeout(() => triggerEmergency(dirs[1], 'Fire'), 600);
                        setTimeout(() => triggerEmergency(dirs[2], 'Police'), 1200);
                      }}
                      className="px-2 py-1 bg-white/5 border border-white/10 text-[8px] font-mono uppercase hover:border-yellow-500 text-yellow-500 transition-all"
                    >
                      Multi_Triage
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[9px] font-mono text-text-secondary uppercase tracking-[2px]">Override_Signal</span>
                  <div className="flex gap-2">
                    <EmergencyBtn onClick={(d) => triggerEmergency(d, 'Ambulance')} label="AMB" color="hover:bg-red-500 border-red-500/20" />
                    <EmergencyBtn onClick={(d) => triggerEmergency(d, 'Fire')} label="FIRE" color="hover:bg-orange-500 border-orange-500/20" />
                    <EmergencyBtn onClick={(d) => triggerEmergency(d, 'Police')} label="POL" color="hover:bg-blue-500 border-blue-500/20" />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[9px] font-mono text-text-secondary uppercase tracking-[2px]">Disaster_Protocol</span>
                  <div className="flex gap-1.5">
                    {(['N', 'E', 'S', 'W'] as string[]).map((short, i) => {
                      const d = (['North', 'East', 'South', 'West'] as LaneDirection[])[i];
                      return (
                        <button
                          key={d}
                          onClick={() => setSim(prev => ({
                            ...prev,
                            isDisasterMode: !prev.isDisasterMode || prev.disasterSource !== d,
                            disasterSource: d
                          }))}
                          className={cn(
                            "w-6 h-6 flex items-center justify-center border text-[8px] font-mono transition-all",
                            sim.isDisasterMode && sim.disasterSource === d ? "bg-accent-red border-accent-red text-white" : "bg-white/5 border-white/10 text-white/40 hover:border-accent-red"
                          )}
                        >
                          {short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Logs Trail */}
            <div className="bg-surface/50 p-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-3 h-3 text-accent-blue" />
                  <span className="text-[10px] font-mono uppercase tracking-[2px] text-accent-blue font-bold">System Audit Trail</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-white/20 uppercase">Sync_Buffer: {logs.length}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar scroll-smooth">
                {logs.length > 0 ? logs.map((log, i) => (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-center justify-between p-2 border transition-all duration-300",
                      i === 0 ? "bg-accent-blue/5 border-accent-blue/20" : "bg-white/[0.01] border-white/5 opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Terminal className={cn("w-3 h-3", i === 0 ? "text-accent-blue" : "text-white/20")} />
                      <span className={cn("text-[9px] font-mono uppercase tracking-tight", i === 0 ? "text-white font-bold" : "text-text-secondary")}>
                        {log.event}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[8px] font-mono text-white/10 italic">SEQ_{log.id.toString().slice(-4)}</span>
                      <span className="text-[8px] font-mono text-white/30">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-[10px] font-mono text-white/10 uppercase tracking-[4px] border border-dashed border-white/5">
                    Awaiting System Events...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface/30 border border-border p-5 flex flex-col backdrop-blur-sm">
              <h3 className="text-[10px] font-mono uppercase text-accent-blue mb-4 flex items-center gap-2 font-bold tracking-widest">
                <Activity className="w-4 h-4" />
                Real-Time Load Analysis
              </h3>
              <div className="flex-1 w-full -ml-4">
                <ResponsiveContainer width="110%" height="100%">
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00F0FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <Area type="monotone" dataKey="totalLoad" stroke="#00F0FF" fillOpacity={1} fill="url(#colorLoad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-surface/30 border border-border p-5 flex flex-col justify-between backdrop-blur-sm">
              <div className="flex justify-between items-start">
                <h3 className="text-[10px] font-mono uppercase text-accent-green font-bold tracking-widest">Network_Stats</h3>
                <Zap className="w-4 h-4 text-accent-green animate-pulse" />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-3xl font-mono text-white font-light tracking-tighter">{metrics[metrics.length - 1]?.avgWait || 0}s</span>
                  <span className="text-[9px] font-mono text-text-secondary uppercase">Estimated_Wait</span>
                </div>
                <div className="h-10 w-px bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-3xl font-mono text-accent-blue font-light tracking-tighter">{Math.round(metrics[metrics.length - 1]?.totalLoad || 0)}%</span>
                  <span className="text-[9px] font-mono text-text-secondary uppercase">Junction_Load</span>
                </div>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-accent-blue transition-all duration-1000" style={{ width: `${Math.min(metrics[metrics.length - 1]?.totalLoad || 0, 100)}%` }} />
              </div>
            </div>
          </div>
        </section>

        <aside className="border-l border-border bg-surface p-6 flex flex-col gap-6 overflow-auto">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
              <span className="text-[11px] font-mono text-white uppercase tracking-[2px]">Clearance Queue</span>
              {sim.emergencyQueue.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-accent-red animate-ping" />}
            </div>
            <div className="space-y-2">
              {sim.emergencyQueue.length > 0 ? sim.emergencyQueue.map((item, idx) => (
                <div key={idx} className={cn(
                  "p-3 bg-bg border-l-2 flex justify-between items-center group relative",
                  idx === 0 ? "border-accent-green bg-accent-green/5" : "border-accent-red"
                )}>
                  <div className="flex flex-col">
                    <span className={cn("text-[10px] font-mono uppercase font-bold tracking-tight", idx === 0 ? "text-accent-green" : "text-accent-red")}>
                      {item.lane} // {sim.lanes[item.lane].emergencyType}
                    </span>
                    <span className="text-[8px] font-mono text-text-secondary uppercase">
                      {idx === 0 ? "ACTIVE_PREEMPTION" : "QUEUED"}
                    </span>
                  </div>
                  {idx === 0 && <span className="text-[9px] font-mono text-accent-green animate-pulse font-bold">NEXT_UP</span>}
                </div>
              )) : (
                <div className="p-10 border border-dashed border-white/5 rounded-md text-center opacity-20 italic text-[10px] font-mono uppercase tracking-[3px]">
                  Listening...
                </div>
              )}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-mono text-text-secondary uppercase block mb-4 italic tracking-widest border-b border-border/30 pb-1">Master Sequencer Status</span>
            <div className="space-y-6">
              {(Object.values(sim.lanes) as LaneState[]).map(lane => {
                const currentDensity = sim.vehicles.filter(v => v.source === lane.direction && v.progress < 0.33).length / 10;
                return (
                  <div key={lane.direction} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[12px] font-mono font-bold tracking-tighter uppercase">{lane.direction} NETWORK</span>
                      <span className={cn("text-[10px] font-mono uppercase font-bold", lane.signalState === 'Green' ? "text-accent-green" : "text-white/20")}>{lane.signalState}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary">
                      <span>Saturation</span>
                      <span>{Math.round(currentDensity * 100)}%</span>
                    </div>
                    <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-300", lane.signalState === 'Green' ? "bg-accent-green" : "bg-white/20")}
                        style={{ width: `${Math.min(currentDensity * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto bg-bg p-4 border border-border">
            <div className="flex gap-2 items-center mb-3">
              <BrainCircuit className="w-4 h-4 text-accent-blue" />
              <span className="text-[10px] font-mono uppercase tracking-[2px]">Logic Diagnostics</span>
            </div>
            <div className="p-3 bg-white/5 border border-white/5 min-h-[60px] flex items-center">
              <p className="text-[10px] font-mono text-text-secondary uppercase leading-relaxed tracking-tighter">
                {isAnalyzing ? "Scanning protocols..." : (aiInsight || "Awaiting scan sequence initialization.")}
              </p>
            </div>
            <button
              onClick={handleAIAnalyze} disabled={isAnalyzing}
              className="w-full mt-4 py-2 border border-accent-blue bg-accent-blue/10 text-accent-blue text-[9px] font-bold uppercase font-mono hover:bg-accent-blue hover:text-bg transition-all outline-none shadow-[0_0_15px_rgba(0,240,255,0.1)]"
            >
              Perform Scan
            </button>
          </div>
        </aside>
      </main>

      <footer className="h-[70px] border-t border-border bg-surface grid grid-cols-3 divide-x divide-border">
        <FooterStat label="Active Scenario" value={sim.isDisasterMode ? "DISASTER_LOCK" : sim.emergencyQueue.length > 0 ? "PRIORITY_TRIAGE" : "FLOW_OPTIMIZATION"} color="text-accent-blue" />
        <FooterStat label="Junction Stability" value="SYNCED" color="text-accent-green" />
        <FooterStat label="Avg Junction Wait" value={`${metrics[metrics.length - 1]?.avgWait || 0}s`} />
      </footer>
    </div>
  );
}

function EmergencyBtn({ label, color, onClick }: { label: string; color: string; onClick: (d: LaneDirection) => void }) {
  return (
    <div className="group relative">
      <button className={cn("px-3 py-1.5 text-[10px] font-mono font-bold border border-white/10 transition-all uppercase", color)}>
        {label}
      </button>
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex flex-col bg-surface border border-border z-[100] p-1 shadow-2xl">
        {(['North', 'East', 'South', 'West'] as LaneDirection[]).map(d => (
          <button key={d} onClick={() => onClick(d)} className="px-3 py-1 text-[9px] font-mono text-left hover:bg-white/5 text-white/60 transition-colors uppercase">
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function FooterStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-4 flex flex-col justify-center items-center text-center">
      <span className="text-[9px] font-mono text-text-secondary uppercase mb-0.5 tracking-widest">{label}</span>
      <span className={cn("text-lg font-mono tracking-tighter uppercase font-bold", color ? color : "text-white")}>{value}</span>
    </div>
  );
}
