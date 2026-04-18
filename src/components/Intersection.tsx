import React from "react";
import { motion } from "motion/react";
import { LaneDirection, LaneState, Vehicle, TurnDirection, VehicleType } from "../types";
import { cn } from "../lib/utils";

interface IntersectionProps {
  lanes: Record<LaneDirection, LaneState>;
  vehicles: Vehicle[];
}

function VehicleSprite({ vehicle }: { vehicle: Vehicle }) {
  const { source, turn, progress, type } = vehicle;
  
  // Quadratic Bezier Interpolation (for smooth turning)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const qBezier = (p0: number, p1: number, p2: number, t: number) => {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  };

  // Coordinate Mapping Logic (LHD India Style - Single Lane per Road)
  const getCoordinates = () => {
    const { source, turn, progress } = vehicle;
    const IN = 0.33;
    const OUT = 0.66;
    
    // Road center offsets (LHD)
    const EAST_OF_CENTER = 58.3;
    const WEST_OF_CENTER = 41.6;
    const NORTH_OF_CENTER = 41.6;
    const SOUTH_OF_CENTER = 58.3;

    let x = 50, y = 50, rotate = 0;

    if (source === 'North') {
      const p0 = { x: EAST_OF_CENTER, y: 33.3 };
      if (progress <= IN) {
        x = p0.x; y = progress * 100; rotate = 180;
      } else if (progress >= OUT) {
        if (turn === 'Straight') { x = EAST_OF_CENTER; y = progress * 100; rotate = 180; }
        else if (turn === 'Left') { x = progress * 100; y = NORTH_OF_CENTER; rotate = 90; }
        else { x = (1 - progress) * 100; y = SOUTH_OF_CENTER; rotate = 270; }
      } else {
        const t = (progress - IN) / (OUT - IN);
        if (turn === 'Straight') { x = EAST_OF_CENTER; y = lerp(33.3, 66.6, t); rotate = 180; }
        else if (turn === 'Left') { // to East
          x = qBezier(58.3, 58.3, 66.6, t);
          y = qBezier(33.3, 41.6, 41.6, t);
          rotate = 180 - t * 90;
        } else { // to West
          x = qBezier(58.3, 58.3, 33.3, t);
          y = qBezier(33.3, 58.3, 58.3, t);
          rotate = 180 + t * 90;
        }
      }
    } else if (source === 'South') {
      const p0 = { x: WEST_OF_CENTER, y: 66.6 };
      if (progress <= IN) {
        y = (1 - progress) * 100; x = p0.x; rotate = 0;
      } else if (progress >= OUT) {
        if (turn === 'Straight') { y = (1 - progress) * 100; x = WEST_OF_CENTER; rotate = 0; }
        else if (turn === 'Left') { x = (1 - progress) * 100; y = SOUTH_OF_CENTER; rotate = 270; }
        else { x = progress * 100; y = NORTH_OF_CENTER; rotate = 90; }
      } else {
        const t = (progress - IN) / (OUT - IN);
        if (turn === 'Straight') { x = WEST_OF_CENTER; y = lerp(66.6, 33.3, t); rotate = 0; }
        else if (turn === 'Left') { // to West
          x = qBezier(41.6, 41.6, 33.3, t);
          y = qBezier(66.6, 58.3, 58.3, t);
          rotate = 0 - t * 90;
        } else { // to East
          x = qBezier(41.6, 41.6, 66.6, t);
          y = qBezier(66.6, 41.6, 41.6, t);
          rotate = 0 + t * 90;
        }
      }
    } else if (source === 'East') {
      const p0 = { x: 66.6, y: SOUTH_OF_CENTER };
      if (progress <= IN) {
        x = (1 - progress) * 100; y = p0.y; rotate = 270;
      } else if (progress >= OUT) {
        if (turn === 'Straight') { x = (1 - progress) * 100; y = SOUTH_OF_CENTER; rotate = 270; }
        else if (turn === 'Left') { y = progress * 100; x = EAST_OF_CENTER; rotate = 180; }
        else { y = (1 - progress) * 100; x = WEST_OF_CENTER; rotate = 0; }
      } else {
        const t = (progress - IN) / (OUT - IN);
        if (turn === 'Straight') { x = lerp(66.6, 33.3, t); y = SOUTH_OF_CENTER; rotate = 270; }
        else if (turn === 'Left') { // to South
          x = qBezier(66.6, 58.3, 58.3, t);
          y = qBezier(58.3, 58.3, 66.6, t);
          rotate = 270 - t * 90;
        } else { // to North
          x = qBezier(66.6, 41.6, 41.6, t);
          y = qBezier(58.3, 58.3, 33.3, t);
          rotate = 270 + t * 90;
        }
      }
    } else if (source === 'West') {
      const p0 = { x: 33.3, y: NORTH_OF_CENTER };
      if (progress <= IN) {
        x = progress * 100; y = p0.y; rotate = 90;
      } else if (progress >= OUT) {
        if (turn === 'Straight') { x = progress * 100; y = NORTH_OF_CENTER; rotate = 90; }
        else if (turn === 'Left') { y = (1 - progress) * 100; x = WEST_OF_CENTER; rotate = 0; }
        else { y = progress * 100; x = EAST_OF_CENTER; rotate = 180; }
      } else {
        const t = (progress - IN) / (OUT - IN);
        if (turn === 'Straight') { x = lerp(33.3, 66.6, t); y = NORTH_OF_CENTER; rotate = 90; }
        else if (turn === 'Left') { // to North
          x = qBezier(33.3, 41.6, 41.6, t);
          y = qBezier(41.6, 41.6, 33.3, t);
          rotate = 90 - t * 90;
        } else { // to South
          x = qBezier(33.3, 58.3, 58.3, t);
          y = qBezier(41.6, 41.6, 66.6, t);
          rotate = 90 + t * 90;
        }
      }
    }

    return { x, y, rotate };
  };

  const { x, y, rotate } = getCoordinates();

  // Color Mapping
  const getVehicleColor = () => {
    if (type === 'Car') {
      // Alternate between light blue and dark blue based on ID
      const seed = vehicle.id.charCodeAt(0) + vehicle.id.charCodeAt(vehicle.id.length - 1);
      return seed % 2 === 0 ? "bg-cyan-400" : "bg-indigo-600";
    }
    const colors = {
      Ambulance: "bg-white",
      FireBrigade: "bg-accent-red",
      PoliceCar: "bg-slate-900"
    };
    return colors[type as keyof typeof colors] || "bg-accent-blue";
  };

  return (
    <motion.div 
      className={cn(
        "absolute w-4 h-6 rounded-sm z-30 flex items-center justify-center shadow-lg border-white/20 border overflow-hidden", 
        getVehicleColor()
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        marginLeft: -8,
        marginTop: -12,
        rotate: `${rotate}deg`
      }}
      initial={false}
      transition={{ type: 'spring', damping: 25, stiffness: 120, mass: 0.8 }}
    >
      {/* Label/Icon Logic */}
      {type === 'Car' ? (
         <div className="w-1.5 h-1 bg-white/30 rounded-full" />
      ) : (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className="text-[7px] font-bold text-white tracking-tighter">
            {type === 'Ambulance' && 'AMB'}
            {type === 'FireBrigade' && 'FIRE'}
            {type === 'PoliceCar' && 'POL'}
          </span>
          {/* Siren Lights */}
          <div className="flex gap-0.5 mt-0.5">
            <div className={cn("w-1 h-1 rounded-full", type === 'FireBrigade' || type === 'Ambulance' ? "bg-red-500 animate-pulse" : "bg-blue-500 animate-pulse")} />
            <div className={cn("w-1 h-1 rounded-full", type === 'PoliceCar' ? "bg-red-500 animate-ping" : "bg-blue-500 animate-pulse")} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

const Lane = ({ direction, state }: { direction: LaneDirection; state: LaneState }) => {
  const positionClasses = {
    North: "top-0 left-[50%] w-1/6 h-1/3 flex-col-reverse justify-center",
    South: "bottom-0 right-[50%] w-1/6 h-1/3 flex-col justify-center",
    East: "right-0 bottom-[50%] w-1/3 h-1/6 flex-row-reverse justify-center",
    West: "left-0 top-[50%] w-1/3 h-1/6 flex-row justify-center",
  };

  return (
    <div 
      className={cn(
        "absolute flex items-center gap-2 transition-all duration-300", 
        positionClasses[direction]
      )}
    >
      {/* Signal Light - Main Visualization */}
      <div className={cn(
        "bg-black/80 p-2 rounded-md border border-white/10 flex gap-2 z-20 shadow-xl scale-110",
        state.hasEmergency && "border-accent-red animate-pulse"
      )}>
        <div className={cn(
          "w-4 h-4 rounded-full transition-all duration-300", 
          state.signalState === 'Red' ? "bg-accent-red shadow-[0_0_15px_var(--color-accent-red)]" : "bg-red-950/20"
        )} />
        <div className={cn(
          "w-4 h-4 rounded-full transition-all duration-300", 
          state.signalState === 'Yellow' ? "bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,1)]" : "bg-yellow-950/20"
        )} />
        <div className={cn(
          "w-4 h-4 rounded-full transition-all duration-300", 
          state.signalState === 'Green' ? "bg-accent-green shadow-[0_0_15px_var(--color-accent-green)]" : "bg-green-950/20"
        )} />
      </div>

      {state.hasEmergency && (
        <div className="absolute -top-10 left-0 right-0 text-center">
           <span className="text-[10px] font-mono text-accent-red font-bold animate-bounce uppercase drop-shadow-lg">
             {state.emergencyType}_CLEARANCE
           </span>
        </div>
      )}
    </div>
  );
};

export const Intersection = ({ lanes, vehicles }: IntersectionProps) => {
  return (
    <div className="relative w-full aspect-square max-w-[500px] bg-bg rounded-none overflow-hidden shadow-none border border-border">
      {/* Visual Road Structure */}
      <div className="absolute inset-0 opacity-10" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
             backgroundSize: '40px 40px' 
           }} 
      />
      
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Vertical Road (NS) - 2 Lanes */}
        <div className="w-1/3 h-full bg-[#150B2D] relative border-x border-dashed border-white/10 flex">
          {/* Median/Divider */}
          <div className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-accent-green/30 shadow-[0_0_10px_var(--color-accent-green)]" />
          
          {/* Stop Lines NS */}
          <div className="absolute top-[33.3%] left-1/2 w-1/2 h-0.5 bg-white/20" />
          <div className="absolute bottom-[33.3%] right-1/2 w-1/2 h-0.5 bg-white/20" />
        </div>
        {/* Horizontal Road (EW) - 2 Lanes */}
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-1/3 bg-[#150B2D] relative border-y border-dashed border-white/10 flex flex-col">
            {/* Median/Divider */}
            <div className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-accent-green/30 shadow-[0_0_10px_var(--color-accent-green)]" />
            
            {/* Stop Lines EW */}
            <div className="absolute left-[33.3%] bottom-1/2 h-1/2 w-0.5 bg-white/20" />
            <div className="absolute right-[33.3%] top-1/2 h-1/2 w-0.5 bg-white/20" />
          </div>
        </div>
      </div>

      {vehicles.map(v => (
        <div key={v.id}>
          <VehicleSprite vehicle={v} />
        </div>
      ))}

      {/* Lanes & Signals */}
      <Lane direction="North" state={lanes.North} />
      <Lane direction="South" state={lanes.South} />
      <Lane direction="East" state={lanes.East} />
      <Lane direction="West" state={lanes.West} />

      {/* Junction Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[33.33%] h-[33.33%] border border-white/10 flex items-center justify-center bg-black/5">
           <div className="font-mono text-[8px] text-text-secondary uppercase opacity-20 tracking-tighter">Autonomous_Gate</div>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 font-mono text-[9px] text-text-secondary leading-tight uppercase opacity-50">
        PROTOCOL: ROUND_ROBIN<br />ENGINE: VEHICLE_SYNC_V1
      </div>
    </div>
  );
};
